'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle } from 'lucide-react';

import {
  MathText,
  StudyError,
  StudyLoading,
  StudyShell,
  progressDot,
  useStudySet,
} from '@/components/study/study-shell';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { Flashcard } from '@/lib/study-set/types';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function FlashcardsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { state, retry } = useStudySet(id);
  const hubHref = `/course/${encodeURIComponent(id)}`;

  return (
    <StudyShell
      backHref={hubHref}
      backLabel={t('study.backCourse')}
      title={t('study.modes.flashcards.title')}
    >
      {state.status === 'loading' && <StudyLoading label={t('study.generating')} />}
      {state.status === 'error' && (
        <StudyError
          message={t(state.notFound ? 'study.notFound' : 'study.generateFailed')}
          onRetry={state.notFound ? undefined : retry}
        />
      )}
      {state.status === 'ready' && <FlashcardDeck cards={state.data.flashcards} />}
    </StudyShell>
  );
}

function FlashcardDeck({ cards: initial }: { cards: Flashcard[] }) {
  const { t } = useI18n();
  const [cards, setCards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
    },
    [cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const restart = (shuffle: boolean) => {
    setCards(shuffle ? shuffled(initial) : initial);
    setIndex(0);
    setFlipped(false);
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 text-sm text-muted-foreground">
        {t('study.cardOf', { n: index + 1, total: cards.length })}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={t('study.flip')}
        className="relative h-72 w-full max-w-xl cursor-pointer [perspective:1200px] md:h-80"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${card.id}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={
              flipped
                ? 'absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-8 shadow-lg dark:border-violet-900 dark:from-violet-950/60 dark:to-fuchsia-950/40'
                : 'absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900'
            }
          >
            <span className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-violet-500">
              {flipped ? t('study.answer') : t('study.question')}
            </span>
            <MathText
              text={flipped ? card.back : card.front}
              className={
                flipped
                  ? 'text-center text-base leading-relaxed text-slate-700 md:text-lg dark:text-slate-200'
                  : 'text-center text-xl font-semibold leading-snug text-slate-900 md:text-2xl dark:text-slate-100'
              }
            />
            {!flipped && (
              <span className="absolute bottom-5 text-xs text-muted-foreground">
                {t('study.tapToFlip')}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </button>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label={t('study.previous')}
          className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex max-w-[60vw] flex-wrap justify-center gap-1">
          {cards.map((c, i) => (
            <span key={c.id} className={progressDot(i === index, i < index)} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          aria-label={t('study.next')}
          className="flex size-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => restart(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-slate-800/70"
        >
          <Shuffle className="size-4" />
          {t('study.shuffle')}
        </button>
        <button
          type="button"
          onClick={() => restart(false)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-slate-800/70"
        >
          <RotateCcw className="size-4" />
          {t('study.restart')}
        </button>
      </div>
      <p className="mt-4 hidden text-xs text-muted-foreground md:block">
        {t('study.keyboardHint')}
      </p>
    </div>
  );
}
