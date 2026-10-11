/**
 * Accounts and sessions in the application's PostgreSQL database.
 *
 * Session tokens are random and only their SHA-256 hash is stored, so a
 * database read does not yield a usable cookie.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { Queryable } from '@openmaic/storage/document/pg';
import { applySchemaMigrations, type SchemaMigrationSet } from '@openmaic/storage/pg-migrations';

import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';

export const AUTH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id)`,
].join(';\n');

export const AUTH_MIGRATIONS: SchemaMigrationSet = {
  store: 'auth',
  migrations: [{ version: 1, name: 'baseline', up: AUTH_SCHEMA, transaction: false }],
};

export const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export class EmailTakenError extends Error {
  constructor() {
    super('an account with this email exists already');
    this.name = 'EmailTakenError';
  }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

let schemaReady: Promise<void> | undefined;

/** Create the account tables if this database has not got them yet. */
export async function ensureAuthSchema(): Promise<void> {
  await pool();
}

async function pool() {
  const provider = await getServerPersistenceProvider(process.env.DATABASE_URL ?? '');
  schemaReady ??= applySchemaMigrations(provider.pool as unknown as Queryable, AUTH_MIGRATIONS)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  await schemaReady;
  return provider.pool;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const ownerIdForUser = (userId: string) => `user:${userId}`;

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const db = await pool();
  const id = randomUUID();
  const email = normalizeEmail(input.email);
  try {
    await db.query(
      'INSERT INTO auth_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
      [id, email, input.name.trim(), input.passwordHash],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new EmailTakenError();
    throw error;
  }
  return { id, email, name: input.name.trim() };
}

export async function findUserWithHash(
  email: string,
): Promise<(AuthUser & { passwordHash: string }) | undefined> {
  const db = await pool();
  const { rows } = await db.query<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
  }>('SELECT id, email, name, password_hash FROM auth_users WHERE email = $1', [
    normalizeEmail(email),
  ]);
  const row = rows[0];
  return row && { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash };
}

/** Create a session; returns the raw token (cookie value) and its expiry. */
export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const db = await pool();
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), userId, expires],
  );
  return { token, expires };
}

export async function getSessionUser(token: string): Promise<AuthUser | undefined> {
  const db = await pool();
  const { rows } = await db.query<{ id: string; email: string; name: string }>(
    `SELECT u.id, u.email, u.name FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0];
}

export async function deleteSession(token: string): Promise<void> {
  const db = await pool();
  await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
}
