'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Check, RotateCcw, Trophy, X } from 'lucide-react';

import {
  MathText,
  StudyError,
  StudyLoading,
  StudyShell,
  progressDot,
  useStudySet,
} from '@/components/study/study-shell';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { StudyQuizQuestion } from '@/lib/study-set/types';
import { cn } from '@/lib/utils';

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { state, retry } = useStudySet(id);
  const hubHref = `/course/${encodeURIComponent(id)}`;

  return (
    <StudyShell
      backHref={hubHref}
      backLabel={t('study.backCourse')}
      title={t('study.modes.quiz.title')}
    >
      {state.status === 'loading' && <StudyLoading label={t('study.generating')} />}
      {state.status === 'error' && (
        <StudyError
          message={t(state.notFound ? 'study.notFound' : 'study.generateFailed')}
          onRetry={state.notFound ? undefined : retry}
        />
      )}
      {state.status === 'ready' && <QuizRunner questions={state.data.quiz} hubHref={hubHref} />}
    </StudyShell>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function QuizRunner({ questions, hubHref }: { questions: StudyQuizQuestion[]; hubHref: string }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);

  const score = questions.filter((q) => picked[q.id] === q.answer).length;

  const restart = () => {
    setIndex(0);
    setPicked({});
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <Trophy className="size-7" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t('study.quizDone')}
        </h2>
        <p className="mt-2 text-4xl font-bold text-violet-600 dark:text-violet-400">{pct}%</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('study.scoreLine', { score, total: questions.length })}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <RotateCcw className="size-4" />
            {t('study.tryAgain')}
          </button>
          <Link
            href={hubHref}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('study.backCourse')}
          </Link>
        </div>
      </motion.div>
    );
  }

  const q = questions[index];
  const answered = picked[q.id] !== undefined;
  const isLast = index === questions.length - 1;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{t('study.questionOf', { n: index + 1, total: questions.length })}</span>
        <div className="flex gap-1">
          {questions.map((item, i) => (
            <span key={item.id} className={progressDot(i === index, i < index)} />
          ))}
        </div>
      </div>

      <motion.div
        key={q.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg md:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <MathText
          text={q.question}
          className="block text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100"
        />

        <div className="mt-6 flex flex-col gap-2.5">
          {q.options.map((option, i) => {
            const isPicked = picked[q.id] === i;
            const isCorrect = q.answer === i;
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => setPicked((p) => ({ ...p, [q.id]: i }))}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition',
                  !answered &&
                    'border-slate-200 hover:border-violet-300 hover:bg-violet-50/60 dark:border-slate-700 dark:hover:border-violet-700 dark:hover:bg-violet-950/30',
                  answered &&
                    isCorrect &&
                    'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100',
                  answered &&
                    isPicked &&
                    !isCorrect &&
                    'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100',
                  answered &&
                    !isPicked &&
                    !isCorrect &&
                    'border-slate-200 opacity-60 dark:border-slate-800',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                    answered && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : answered && isPicked
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {answered && isCorrect ? (
                    <Check className="size-4" />
                  ) : answered && isPicked ? (
                    <X className="size-4" />
                  ) : (
                    LETTERS[i]
                  )}
                </span>
                <MathText text={option} className="flex-1" />
              </button>
            );
          })}
        </div>

        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60"
          >
            <p
              className={cn(
                'font-semibold',
                picked[q.id] === q.answer ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {picked[q.id] === q.answer ? t('study.correct') : t('study.incorrect')}
            </p>
            {q.explanation && (
              <MathText
                text={q.explanation}
                className="mt-1 block text-slate-600 dark:text-slate-300"
              />
            )}
          </motion.div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!answered}
            onClick={() => (isLast ? setFinished(true) : setIndex((i) => i + 1))}
            className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-40"
          >
            {isLast ? t('study.seeResults') : t('study.next')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
