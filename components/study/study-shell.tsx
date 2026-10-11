'use client';

import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileQuestion, Loader2 } from 'lucide-react';

import { useI18n } from '@/lib/hooks/use-i18n';
import { renderQuizMathText } from '@/lib/quiz/math-text';
import type { CourseOverview, CourseSlide, StudySet } from '@/lib/study-set/types';
import { cn } from '@/lib/utils';

/** Text with inline LaTeX, rendered the way the classroom quiz renders it. */
export const MathText = memo(function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = useMemo(() => renderQuizMathText(text), [text]);
  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.type === 'text' ? (
          <span key={i}>{segment.value}</span>
        ) : (
          <span
            key={i}
            className="inline-block align-baseline [&_.katex-display]:!my-0"
            dangerouslySetInnerHTML={{ __html: segment.html }}
          />
        ),
      )}
    </span>
  );
});

/** Page frame shared by the course hub, flashcards and quiz. */
export function StudyShell({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
}: {
  backHref: string;
  backLabel: string;
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex w-full max-w-4xl flex-col px-4 pt-6 pb-16 md:px-8 md:pt-10">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-slate-800/70"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        {title && (
          <header className="mt-6 mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-slate-100">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

export function StudyLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-violet-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function StudyError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center text-muted-foreground">
      <FileQuestion className="size-10 text-slate-400" />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
        >
          {t('study.retry')}
        </button>
      )}
    </div>
  );
}

type Loadable<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; notFound: boolean };

function useJson<T>(url: string, attempt: number): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'error', notFound: res.status === 404 });
          return;
        }
        setState({ status: 'ready', data: (await res.json()) as T });
      })
      .catch(() => !cancelled && setState({ status: 'error', notFound: false }));
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);
  return state;
}

export function useCourseOverview(id: string) {
  return useJson<CourseOverview>(`/api/stages/${encodeURIComponent(id)}/overview`, 0);
}

export function useCourseSlides(id: string) {
  const [attempt, setAttempt] = useState(0);
  const state = useJson<CourseSlide[]>(`/api/stages/${encodeURIComponent(id)}/slides`, attempt);
  return { state, retry: () => setAttempt((n) => n + 1) };
}

export function useStudySet(id: string) {
  const [attempt, setAttempt] = useState(0);
  const state = useJson<StudySet>(`/api/stages/${encodeURIComponent(id)}/study-set`, attempt);
  return { state, retry: () => setAttempt((n) => n + 1) };
}

export const progressDot = (active: boolean, done: boolean) =>
  cn(
    'h-1.5 rounded-full transition-all',
    active
      ? 'w-6 bg-violet-500'
      : done
        ? 'w-1.5 bg-violet-300'
        : 'w-1.5 bg-slate-300 dark:bg-slate-700',
  );
