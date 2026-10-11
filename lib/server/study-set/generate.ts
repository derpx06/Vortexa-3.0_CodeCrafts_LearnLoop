/**
 * Turn a course's scenes into flashcards and a multiple-choice quiz with one
 * LLM call. The model sees what a learner sees and hears: slide text, the
 * teacher's narration, and any quiz questions the course already has.
 */
import type { NextRequest } from 'next/server';

import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import type { Flashcard, StudyQuizQuestion, StudySet } from '@/lib/study-set/types';

import type { CourseSceneRow } from './store';

/** Keeps the prompt well inside any provider's context window. */
const MAX_COURSE_CHARS = 24_000;

export const FLASHCARD_COUNT = 12;
export const QUIZ_COUNT = 8;

const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

function sceneText(scene: CourseSceneRow): string {
  const parts: string[] = [];
  const content = scene.data.content as Record<string, unknown> | undefined;

  if (scene.type === 'slide') {
    const elements = ((content?.canvas as Record<string, unknown> | undefined)?.elements ??
      []) as Array<Record<string, unknown>>;
    for (const el of elements) {
      if (el.type === 'text' && typeof el.content === 'string') parts.push(stripHtml(el.content));
      if (el.type === 'latex' && typeof el.latex === 'string') parts.push(`$${el.latex}$`);
    }
  }

  if (scene.type === 'quiz') {
    const questions = (content?.questions ?? []) as Array<Record<string, unknown>>;
    for (const q of questions) parts.push(`Q: ${String(q.question ?? '')}`);
  }

  const actions = (scene.data.actions ?? []) as Array<Record<string, unknown>>;
  const narration = actions
    .filter((a) => a.type === 'speech' && typeof a.text === 'string')
    .map((a) => a.text as string)
    .join(' ');
  if (narration) parts.push(`Narration: ${narration}`);

  return parts.filter(Boolean).join('\n');
}

export function courseTranscript(
  name: string,
  description: string | undefined,
  scenes: CourseSceneRow[],
): string {
  const header = `Course: ${name}${description ? `\nDescription: ${description}` : ''}`;
  const body = scenes
    .map((scene, i) => `## ${i + 1}. ${scene.title} (${scene.type})\n${sceneText(scene)}`)
    .join('\n\n');
  return `${header}\n\n${body}`.slice(0, MAX_COURSE_CHARS);
}

const SYSTEM_PROMPT = `You are an expert teacher who writes study material.
From the course below, write flashcards and a multiple-choice quiz that cover its key ideas.

Rules:
- Exactly ${FLASHCARD_COUNT} flashcards. "front" is a short question or term; "back" is a concise answer (1-3 sentences).
- Exactly ${QUIZ_COUNT} quiz questions, each with exactly 4 options and one correct answer. "answer" is the 0-based index of the correct option. Vary the position of the correct option.
- "explanation" says in one or two sentences why the answer is right.
- Use only facts taught in the course. Write in the course's language.
- Math may use LaTeX between $...$.

Reply with JSON only, no other text:
{"flashcards":[{"front":"...","back":"..."}],"quiz":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`;

function parseStudySet(text: string): Omit<StudySet, 'generatedAt'> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model reply contained no JSON object');
  const parsed = JSON.parse(match[0]) as {
    flashcards?: Array<Record<string, unknown>>;
    quiz?: Array<Record<string, unknown>>;
  };

  const flashcards: Flashcard[] = (parsed.flashcards ?? [])
    .filter((c) => typeof c.front === 'string' && typeof c.back === 'string')
    .map((c, i) => ({ id: `fc_${i}`, front: String(c.front).trim(), back: String(c.back).trim() }));

  const quiz: StudyQuizQuestion[] = (parsed.quiz ?? [])
    .filter(
      (q) =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        Number.isInteger(q.answer) &&
        (q.answer as number) >= 0 &&
        (q.answer as number) < q.options.length,
    )
    .map((q, i) => ({
      id: `q_${i}`,
      question: String(q.question).trim(),
      options: (q.options as unknown[]).map((o) => String(o).trim()),
      answer: q.answer as number,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : undefined,
    }));

  if (flashcards.length === 0 || quiz.length === 0) {
    throw new Error('Model reply had no usable flashcards or quiz questions');
  }
  return { flashcards, quiz };
}

function isParseable(text: string): boolean {
  try {
    parseStudySet(text);
    return true;
  } catch {
    return false;
  }
}

export async function generateStudySet(req: NextRequest, transcript: string): Promise<StudySet> {
  // The quiz-content slot: the model the deployment uses to write quizzes.
  const { model, thinkingConfig, serverManaged } = await resolveModelFromRequest(
    req,
    {},
    'scene-content:quiz',
  );
  const result = await callLLM(
    { model, system: SYSTEM_PROMPT, prompt: transcript },
    'study-set',
    { retries: 1, validate: isParseable },
    thinkingConfig,
    { serverManaged },
  );
  return { ...parseStudySet(result.text), generatedAt: Date.now() };
}
