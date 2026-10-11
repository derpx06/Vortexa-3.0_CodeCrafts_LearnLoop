'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

import { logout } from '@/app/(auth)/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useUserProfileStore } from '@/lib/store/user-profile';

interface SessionUser {
  email: string;
  name: string;
}

const SEEDED_FOR_KEY = 'learnloop:profile-seeded-for';

/**
 * Make the greeting nickname belong to the signed-in account. The profile
 * store may be kept per browser, so when a different account signs in on the
 * same browser its name replaces the previous account's. A nickname the user
 * edited themselves is kept for as long as the same account stays signed in.
 * Runs after the store has hydrated, so hydration cannot overwrite the seed.
 */
function seedProfileFor(user: SessionUser) {
  const apply = () => {
    let seededFor: string | null = null;
    try {
      seededFor = localStorage.getItem(SEEDED_FOR_KEY);
    } catch {
      /* storage unavailable */
    }
    const store = useUserProfileStore.getState();
    if (seededFor !== user.email || !store.nickname) {
      store.setNickname(user.name);
      try {
        localStorage.setItem(SEEDED_FOR_KEY, user.email);
      } catch {
        /* not remembered; re-seeded next load */
      }
    }
  };
  if (useUserProfileStore.persist.hasHydrated()) apply();
  else {
    const unsubscribe = useUserProfileStore.persist.onFinishHydration(() => {
      unsubscribe();
      apply();
    });
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';

/**
 * Account pill: a violet-ringed avatar echoing the GreetingBar motif, with a
 * dropdown for Log out. Authentication is compulsory, so there is no "Log in"
 * branch — the middleware never lets a signed-out visitor reach a page that
 * renders this component.
 */
export function AccountMenu() {
  const { t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (cancelled) return;
        setUser(d.user ?? null);
        if (d.user) seedProfileFor(d.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group flex items-center gap-2 rounded-full px-1 py-1 pr-3 text-xs font-medium text-gray-600 transition-all hover:bg-white hover:shadow-sm dark:text-gray-300 dark:hover:bg-gray-700"
        aria-label={user.name}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-[10px] font-semibold text-white ring-[1.5px] ring-violet-300/70 transition-all group-hover:ring-violet-400/80 dark:ring-violet-500/40">
          {initials(user.name)}
        </span>
        <span className="max-w-[8rem] truncate">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel className="font-normal">
          <div className="text-[13px] font-medium text-foreground">{user.name}</div>
          <div className="text-[11px] text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await logout();
            window.location.href = '/login';
          }}
        >
          <LogOut className="size-4" />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
