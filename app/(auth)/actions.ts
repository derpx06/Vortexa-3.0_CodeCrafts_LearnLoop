'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { hashPassword, verifyPassword } from '@/lib/server/auth/password';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/server/auth/owner-method';
import {
  createSession,
  createUser,
  deleteSession,
  EmailTakenError,
  findUserWithHash,
} from '@/lib/server/auth/store';
import { SlidingWindowFailureLimiter } from '@/lib/server/attempt-limiter';
import { clientIdentity } from '@/lib/server/client-identity';

export interface AuthFormState {
  /** Stable code the form maps to a translated message. */
  error?: 'invalid' | 'emailTaken' | 'badCredentials' | 'rateLimited' | 'unavailable';
  fieldErrors?: { name?: boolean; email?: boolean; password?: boolean };
  email?: string;
  name?: string;
}

const limiter = new SlidingWindowFailureLimiter({ maxFailures: 10, windowMs: 10 * 60_000 });

const Email = z.string().trim().toLowerCase().email().max(254);
const SignupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: Email,
  password: z.string().min(8).max(200),
});
const LoginSchema = z.object({ email: Email, password: z.string().min(1).max(200) });

/** Only same-site relative paths, so `next` cannot send a user elsewhere. */
function safeNext(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

async function startSession(userId: string) {
  const { token, expires } = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expires));
}

async function attemptKey(scope: string, email: string) {
  return `${scope}:${clientIdentity({ headers: await headers() })}:${email}`;
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    return {
      error: 'invalid',
      fieldErrors: {
        name: bad.has('name'),
        email: bad.has('email'),
        password: bad.has('password'),
      },
      name: raw.name,
      email: raw.email,
    };
  }
  const { name, email, password } = parsed.data;
  if (limiter.consume(await attemptKey('signup', email)).limited) {
    return { error: 'rateLimited', name, email };
  }
  try {
    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    await startSession(user.id);
  } catch (error) {
    if (error instanceof EmailTakenError) return { error: 'emailTaken', name, email };
    console.error('signup failed', error);
    return { error: 'unavailable', name, email };
  }
  redirect(safeNext(formData.get('next')));
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { error: 'invalid', email: raw.email };
  const { email, password } = parsed.data;
  const key = await attemptKey('login', email);
  if (limiter.consume(key).limited) return { error: 'rateLimited', email };
  try {
    const user = await findUserWithHash(email);
    // Verify against a throwaway hash for unknown emails so timing does not reveal them.
    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyPassword(password, DUMMY_HASH), false);
    if (!user || !ok) return { error: 'badCredentials', email };
    limiter.recordSuccess(key);
    await startSession(user.id);
  } catch (error) {
    console.error('login failed', error);
    return { error: 'unavailable', email };
  }
  redirect(safeNext(formData.get('next')));
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token).catch(() => {});
  jar.delete(SESSION_COOKIE);
}

const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
