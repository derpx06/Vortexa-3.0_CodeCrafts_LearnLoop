/**
 * The account session as an owner auth method: the session cookie resolves to
 * a `user:<uuid>` owner. No cookie is `not-applicable` (the anonymous cookie
 * answers instead); an unknown or expired cookie is `invalid`.
 */
import { cookiesAreSecure } from '@/lib/server/cookie-secure';
import type { OwnerAuthMethod, OwnerAuthRequest } from '@/lib/server/identity/types';
import { OWNER_ROLES } from '@/lib/server/identity/types';

import { getSessionUser, ownerIdForUser, SESSION_DAYS } from './store';

export const SESSION_COOKIE = 'learnloop_session';

export function readSessionToken(headers: Headers): string | undefined {
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=') || undefined;
  }
  return undefined;
}

export function sessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookiesAreSecure(),
    path: '/',
    expires: expires ?? new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  };
}

const USER_ROLES = new Set<string>([OWNER_ROLES.coursePublish]);

export const accountSessionAuthMethod: OwnerAuthMethod = {
  name: 'accountSession',
  async authenticate(req: OwnerAuthRequest) {
    const token = readSessionToken(req.headers);
    if (!token) return { status: 'not-applicable' };
    const user = await getSessionUser(token);
    if (!user) return { status: 'invalid', reason: 'unknown or expired session' };
    return {
      status: 'authenticated',
      principal: {
        ownerId: ownerIdForUser(user.id),
        kind: 'user',
        roles: USER_ROLES,
        assurance: 'verified',
        channel: 'web',
      },
    };
  },
  describeStoredOwner(ownerId) {
    return ownerId.startsWith('user:') ? { kind: 'user', roles: USER_ROLES } : undefined;
  },
};
