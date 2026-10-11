'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, Layers, ListChecks, Presentation, type LucideIcon } from 'lucide-react';

import {
  StudyError,
  StudyLoading,
  StudyShell,
  useCourseOverview,
} from '@/components/study/study-shell';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface ModeCard {
  key: 'slides' | 'flashcards' | 'quiz';
  href: string;
  icon: LucideIcon;
  accent: string;
}

/**
 * The course hub: opening a course lands here, and the learner picks how to
 * study it — the narrated slide classroom, flashcards, or a quiz.
 */
export default function CourseHubPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const overview = useCourseOverview(id);
  const base = `/course/${encodeURIComponent(id)}`;

  const modes: ModeCard[] = [
    {
      key: 'slides',
      href: `/classroom/${encodeURIComponent(id)}`,
      icon: Presentation,
      accent: 'from-blue-500 to-indigo-500',
    },
    {
      key: 'flashcards',
      href: `${base}/flashcards`,
      icon: Layers,
      accent: 'from-violet-500 to-fuchsia-500',
    },
    {
      key: 'quiz',
      href: `${base}/quiz`,
      icon: ListChecks,
      accent: 'from-emerald-500 to-teal-500',
    },
  ];

  if (overview.status !== 'ready') {
    return (
      <StudyShell backHref="/" backLabel={t('study.backHome')}>
        {overview.status === 'loading' ? (
          <StudyLoading label={t('study.loadingCourse')} />
        ) : (
          <StudyError message={t(overview.notFound ? 'study.notFound' : 'study.loadFailed')} />
        )}
      </StudyShell>
    );
  }

  const course = overview.data;
  return (
    <StudyShell
      backHref="/"
      backLabel={t('study.backHome')}
      title={course.name}
      subtitle={course.description || t('study.chooseMode')}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {modes.map((mode, i) => {
          const Icon = mode.icon;
          return (
            <motion.div
              key={mode.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
            >
              <Link
                href={mode.href}
                className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-violet-700"
              >
                <div
                  className={cn(
                    'mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                    mode.accent,
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t(`study.modes.${mode.key}.title`)}
                </h2>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  {mode.key === 'slides'
                    ? t('study.modes.slides.description', { n: course.slideCount })
                    : t(`study.modes.${mode.key}.description`)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400">
                  {t('study.start')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
      {!course.hasStudySet && (
        <p className="mt-6 text-center text-xs text-muted-foreground">{t('study.firstOpenHint')}</p>
      )}
    </StudyShell>
  );
}
