'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Globe } from 'lucide-react';
import type { Slide } from '@openmaic/dsl';

import { LibrarySkeleton } from '@/components/discovery/library-skeleton';
import { ThumbnailSkeleton } from '@/components/discovery/thumbnail-skeleton';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { useCourseThumbnails } from '@/lib/hooks/use-course-thumbnails';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useNearViewport } from '@/lib/hooks/use-near-viewport';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  LIBRARY_CHANGED_EVENT,
  listPublicStages,
  type PublicStageItem,
} from '@/lib/utils/stage-storage';

const log = createLogger('PublicCourses');

const OPEN_STORAGE_KEY = 'publicClassroomsOpen';

const initial = (name: string | null) => (name?.trim()[0] ?? '?').toUpperCase();

/**
 * Courses other users have published, under the home page's Recent section.
 * Same divider header and grid as Recent; cards are read-only and carry the
 * author's name. Opening one goes to the course hub; its classroom is read-only for a
 * non-owner.
 */
export function PublicCoursesSection({ formatDate }: { formatDate: (ts: number) => string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [courses, setCourses] = useState<PublicStageItem[] | null>(null);
  const [open, setOpen] = useState(true);
  const { thumbnails, requestThumbnail, retainThumbnails } = useCourseThumbnails();

  useEffect(() => {
    try {
      // Read after mount, not during render, so SSR and hydration agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(OPEN_STORAGE_KEY) === 'false') setOpen(false);
    } catch {
      /* storage unavailable: stay open */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listPublicStages()
        .then((list) => {
          if (cancelled) return;
          setCourses(list);
          retainThumbnails(new Set(list.map((c) => c.id)));
        })
        .catch((err) => {
          log.error('Failed to load public courses:', err);
          if (!cancelled) setCourses((prev) => prev ?? []);
        });
    void load();
    window.addEventListener(LIBRARY_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(LIBRARY_CHANGED_EVENT, load);
    };
  }, [retainThumbnails]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, String(next));
    } catch {
      /* not persisted */
    }
  };

  return (
    <div className="relative z-10 mt-12 w-full max-w-6xl flex flex-col items-center">
      <div className="group w-full flex items-center gap-4 h-9">
        <div className="flex-1 h-px bg-border/40 group-hover:bg-border/70 transition-colors" />
        <button
          onClick={toggle}
          className="shrink-0 flex items-center gap-2 text-[13px] text-muted-foreground/60 hover:text-foreground/70 transition-colors cursor-pointer select-none"
        >
          <Globe className="size-3.5" />
          {t('classroom.publicClassrooms')}
          {courses ? (
            <span className="text-[11px] tabular-nums opacity-60">{courses.length}</span>
          ) : (
            <span
              aria-hidden
              className="h-3 w-4 rounded-sm bg-slate-200/70 dark:bg-slate-700/50 animate-pulse"
            />
          )}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="size-3.5" />
          </motion.div>
        </button>
        <div className="flex-1 h-px bg-border/40 group-hover:bg-border/70 transition-colors" />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full overflow-hidden"
          >
            <div className="pt-8 pb-4">
              {courses === null ? (
                <LibrarySkeleton />
              ) : courses.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground/50">
                  {t('classroom.publicEmpty')}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
                  {courses.map((course, i) => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                    >
                      <PublicCourseCard
                        course={course}
                        slide={thumbnails[course.id]}
                        requestThumbnail={requestThumbnail}
                        formatDate={formatDate}
                        onClick={() => router.push(`/course/${course.id}`)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PublicCourseCard({
  course,
  slide,
  requestThumbnail,
  formatDate,
  onClick,
}: {
  course: PublicStageItem;
  slide?: Slide | null;
  requestThumbnail: (stageId: string, version: number) => () => void;
  formatDate: (ts: number) => string;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const nearViewport = useNearViewport(thumbRef);

  useEffect(() => {
    if (!nearViewport) return;
    return requestThumbnail(course.id, course.updatedAt);
  }, [nearViewport, requestThumbnail, course.id, course.updatedAt]);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setThumbWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const author = course.authorName ?? t('classroom.unknownAuthor');

  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div
        ref={thumbRef}
        className="relative w-full aspect-[16/9] rounded-2xl bg-slate-100 dark:bg-slate-800/80 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]"
      >
        {slide && thumbWidth > 0 ? (
          <SlideThumbnail
            slide={slide}
            size={thumbWidth}
            viewportSize={slide.viewportSize ?? 1000}
            viewportRatio={slide.viewportRatio ?? 0.5625}
          />
        ) : slide === undefined || slide ? (
          <ThumbnailSkeleton />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        )}

        {/* Author chip over the thumbnail, GreetingBar avatar motif. */}
        <span className="absolute bottom-2 left-2 z-10 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-white/80 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/70">
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white',
              'bg-gradient-to-br from-violet-500 to-purple-600 ring-1 ring-violet-300/70 dark:ring-violet-500/40',
            )}
          >
            {initial(course.authorName)}
          </span>
          <span className="truncate">{t('classroom.byAuthor', { name: author })}</span>
        </span>
      </div>

      <div className="mt-2.5 px-1 flex items-center gap-2">
        <span className="shrink-0 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
          {course.sceneCount} {t('classroom.slides')} ·{' '}
          {formatDate(course.publishedAt ?? course.updatedAt)}
        </span>
        <p
          className="font-medium text-[15px] truncate text-foreground/90 min-w-0"
          title={course.name}
        >
          {course.name}
        </p>
      </div>
    </div>
  );
}
