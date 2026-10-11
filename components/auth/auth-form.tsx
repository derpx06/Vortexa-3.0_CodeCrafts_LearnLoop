'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';

import { login, signup, type AuthFormState } from '@/app/(auth)/actions';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useBrand } from '@/lib/brand/brand-context';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

type FieldName = 'name' | 'email' | 'password';

/**
 * One row inside the composer-style card: label floats above the input, no
 * row border, focus just lifts the whole surface via `focus-within` on the
 * card. Mirrors the home-page textarea rhythm (`app/page.tsx:1603`).
 */
function Row({
  id,
  label,
  invalid,
  hint,
  trailing,
  ...props
}: React.ComponentProps<'input'> & {
  id: FieldName;
  label: string;
  invalid?: boolean;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="group px-5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className={cn(
            'text-[11px] font-medium transition-colors',
            invalid
              ? 'text-red-500 dark:text-red-400'
              : 'text-muted-foreground/70 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400',
          )}
        >
          {label}
        </label>
        {hint && !invalid && <span className="text-[10px] text-muted-foreground/50">{hint}</span>}
      </div>
      <div className="relative flex items-center">
        <input
          id={id}
          name={id}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-9 w-full border-0 bg-transparent px-0 pr-10 text-[14px] font-medium outline-none',
            'text-foreground/90 placeholder:text-muted-foreground/30',
          )}
          {...props}
        />
        {trailing && <div className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  );
}

/** Pill chip matching GreetingBar / AgentBar atoms. */
function FeatureChip({
  icon: Icon,
  children,
}: {
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-white/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground/80 backdrop-blur-md dark:bg-gray-800/50">
      <Icon className="size-3 text-violet-500 dark:text-violet-400" />
      {children}
    </span>
  );
}

/**
 * Mode switcher using the ProBadge recipe (`components/workbench/ProBadge.tsx`).
 * The active tab wears the signature violet halo so the page has at least one
 * instance of the stamped-pill vocabulary from the pro-swap system.
 */
function ModeSwitch({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const { t } = useI18n();
  const q = next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
  const base =
    'inline-flex items-center justify-center px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] rounded-full border transition-all duration-200';
  const active =
    'border-violet-500/70 bg-violet-600 text-white shadow-[0_0_0_3px_rgba(139,92,246,0.14),0_1px_6px_rgba(109,40,217,0.35)]';
  const inactive =
    'border-border/60 bg-background/50 text-muted-foreground hover:border-violet-400/70 hover:bg-violet-50/60 hover:text-violet-600 dark:hover:bg-violet-900/20';
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/40 p-1 backdrop-blur-md">
      <Link href={`/login${q}`} className={cn(base, mode === 'login' ? active : inactive)}>
        {t('auth.login')}
      </Link>
      <Link href={`/signup${q}`} className={cn(base, mode === 'signup' ? active : inactive)}>
        {t('auth.signup')}
      </Link>
    </div>
  );
}

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const { t } = useI18n();
  const brand = useBrand();
  const isSignup = mode === 'signup';
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    isSignup ? signup : login,
    {},
  );

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-4 pt-16 md:pt-20">
      {/* Background decor — identical palette to the home hero. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-1/4 size-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute bottom-0 right-1/4 size-96 rounded-full bg-purple-500/10 blur-3xl animate-pulse"
          style={{ animationDuration: '6s' }}
        />
      </div>

      {/* Floating pill — exact shape of the home-page top-right toolbar. */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full border border-gray-100/50 bg-white/60 px-2 py-1.5 shadow-sm backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-800/60">
        <LanguageSwitcher onOpen={() => {}} />
      </div>

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center animate-in fade-in slide-in-from-bottom-5 duration-500">
        {/* Logo + stamped shoulder badge — view-transition name shared with
            the home-page lockup so sign-in handoff morphs the mark in place. */}
        <div
          className="relative animate-in fade-in zoom-in-90 duration-500 delay-100"
          data-pro-morph="lockup"
        >
          <img src={brand.logoSrc} alt={brand.productName} className="h-12 md:h-14" />
          <span className="absolute left-full top-1 ml-2 inline-flex items-center rounded-full border border-violet-500/70 bg-violet-600 px-[7px] py-[2px] text-[9.5px] font-semibold uppercase leading-[1.35] tracking-[0.2em] text-white shadow-[0_0_0_3px_rgba(139,92,246,0.14),0_1px_6px_rgba(109,40,217,0.35)]">
            {isSignup ? 'JOIN' : 'IN'}
          </span>
        </div>

        <p className="mt-2 text-center text-sm text-muted-foreground/60 animate-in fade-in duration-300 delay-200">
          {t('home.slogan')}
        </p>

        {/* Feature chips row — same atom as GreetingBar / AgentBar pills. */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 animate-in fade-in duration-300 delay-300">
          <FeatureChip icon={Wand2}>{t('auth.featureGenerate')}</FeatureChip>
          <FeatureChip icon={Users}>{t('auth.featureAgents')}</FeatureChip>
          <FeatureChip icon={Sparkles}>{t('auth.featureSync')}</FeatureChip>
        </div>

        {/* The card: composer recipe verbatim. */}
        <div
          data-pro-morph="composer"
          className="mt-6 w-full overflow-hidden rounded-2xl border border-border/60 bg-white/80 shadow-xl shadow-black/[0.03] backdrop-blur-xl transition-shadow focus-within:shadow-2xl focus-within:shadow-violet-500/[0.06] dark:bg-slate-900/80 dark:shadow-black/20 animate-in fade-in zoom-in-97 duration-300 delay-350"
        >
          {/* Header row with mode switcher on the right. */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold tracking-tight text-foreground/90">
                {t(isSignup ? 'auth.signupTitle' : 'auth.loginTitle')}
              </h1>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {t(isSignup ? 'auth.signupDescription' : 'auth.loginDescription')}
              </p>
            </div>
            <ModeSwitch mode={mode} next={next} />
          </div>

          <form action={action} noValidate>
            <input type="hidden" name="next" value={next} />

            {/* Rows live on the card itself, separated by hairline dividers —
                no inner box. This is the home-composer rhythm (greeting +
                textarea + toolbar stack with no inner border). */}
            <div className="mt-1 divide-y divide-border/40 border-y border-border/40">
              {isSignup && (
                <Row
                  id="name"
                  label={t('auth.name')}
                  autoComplete="name"
                  defaultValue={state.name}
                  invalid={state.fieldErrors?.name}
                  placeholder={t('auth.namePlaceholder')}
                  required
                />
              )}
              <Row
                id="email"
                type="email"
                label={t('auth.email')}
                autoComplete="email"
                defaultValue={state.email}
                invalid={state.fieldErrors?.email}
                placeholder="you@example.com"
                required
              />
              <Row
                id="password"
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password')}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                hint={isSignup ? t('auth.passwordHint') : undefined}
                invalid={state.fieldErrors?.password}
                placeholder="••••••••"
                required
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                }
              />
            </div>

            {state.error && (
              <div
                role="alert"
                className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-2 text-[12px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                {t(`auth.errors.${state.error}`)}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 p-5 pt-4">
              <span className="text-[12px] text-muted-foreground/70">{t('auth.secureNote')}</span>
              <button
                type="submit"
                disabled={pending}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[12px] font-semibold uppercase tracking-[0.14em] transition-all duration-200 active:scale-[0.97]',
                  pending
                    ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
                    : 'bg-violet-600 text-white shadow-[0_0_0_3px_rgba(139,92,246,0.14),0_1px_6px_rgba(109,40,217,0.35)] hover:bg-violet-500 hover:shadow-[0_0_0_4px_rgba(139,92,246,0.18),0_2px_8px_rgba(109,40,217,0.4)]',
                )}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{t('auth.submitting')}</span>
                  </>
                ) : (
                  <>
                    <span>{t(isSignup ? 'auth.submitSignup' : 'auth.submitLogin')}</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/60">
          {t('auth.terms')}
        </p>
      </div>
    </div>
  );
}
