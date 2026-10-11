'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import type { Slide } from '@openmaic/dsl';

import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import {
  StudyError,
  StudyLoading,
  StudyShell,
  useCourseSlides,
} from '@/components/study/study-shell';
import { MediaStageProvider } from '@/lib/contexts/media-stage-context';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { CourseSlide } from '@/lib/study-set/types';
import { cn } from '@/lib/utils';

const DEFAULT_RATIO = 0.5625;

const ratioOf = (slide: CourseSlide) =>
  typeof slide.canvas.viewportRatio === 'number' ? slide.canvas.viewportRatio : DEFAULT_RATIO;

/**
 * The course's slides on their own, like a presentation: no narration, no AI
 * teachers. The full narrated classroom is the hub's "Course" mode.
 */
export default function SlidesPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { state, retry } = useCourseSlides(id);

  return (
    <StudyShell
      backHref={`/course/${encodeURIComponent(id)}`}
      backLabel={t('study.backCourse')}
      title={t('study.modes.slides.title')}
    >
      {state.status === 'loading' && <StudyLoading label={t('study.loadingCourse')} />}
      {state.status === 'error' && (
        <StudyError
          message={t(state.notFound ? 'study.notFound' : 'study.loadFailed')}
          onRetry={state.notFound ? undefined : retry}
        />
      )}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <StudyError message={t('study.noSlides')} />
        ) : (
          <MediaStageProvider value={id}>
            <SlideDeck slides={state.data} />
          </MediaStageProvider>
        ))}
    </StudyShell>
  );
}

function SlideDeck({ slides }: { slides: CourseSlide[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const slide = slides[index];

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + delta))),
    [slides.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(slides.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, slides.length]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-slide-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex w-full items-center justify-between text-sm text-muted-foreground">
        <span className="truncate pr-4">{slide.title}</span>
        <span className="shrink-0">
          {t('study.slideOf', { n: index + 1, total: slides.length })}
        </span>
      </div>

      <div
        ref={stageRef}
        className={cn(
          'relative w-full',
          fullscreen && 'flex items-center justify-center bg-black',
        )}
      >
        <div
          className={cn(
            'relative w-full overflow-hidden bg-white',
            fullscreen
              ? 'max-h-full'
              : 'rounded-2xl border border-slate-200 shadow-lg dark:border-slate-800',
          )}
          style={{
            aspectRatio: `${1 / ratioOf(slide)}`,
            ...(fullscreen ? { width: `min(100vw, ${100 / ratioOf(slide)}vh)` } : {}),
          }}
        >
          <SlideThumbnail
            key={slide.sceneId}
            slide={slide.canvas as unknown as Slide}
            viewportRatio={ratioOf(slide)}
            sceneId={slide.sceneId}
          />
          {/* Click the left or right half to move, like a presentation. */}
          <button
            type="button"
            aria-label={t('study.previous')}
            onClick={() => go(-1)}
            className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize"
          />
          <button
            type="button"
            aria-label={t('study.next')}
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label={t('study.previous')}
          className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-slate-800/70"
        >
          {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          {t(fullscreen ? 'study.exitFullscreen' : 'study.fullscreen')}
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === slides.length - 1}
          aria-label={t('study.next')}
          className="flex size-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div ref={stripRef} className="mt-6 flex w-full gap-3 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <button
            key={s.sceneId}
            type="button"
            data-slide-index={i}
            onClick={() => setIndex(i)}
            aria-label={t('study.slideOf', { n: i + 1, total: slides.length })}
            className={cn(
              'relative w-32 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition',
              i === index
                ? 'border-violet-500 shadow-md'
                : 'border-transparent opacity-70 hover:opacity-100',
            )}
            style={{ aspectRatio: `${1 / ratioOf(s)}` }}
          >
            <SlideThumbnail
              slide={s.canvas as unknown as Slide}
              viewportRatio={ratioOf(s)}
              sceneId={s.sceneId}
            />
            <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 text-[10px] font-medium text-white">
              {i + 1}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 hidden text-xs text-muted-foreground md:block">
        {t('study.slidesKeyboardHint')}
      </p>
    </div>
  );
}
