import { SESSION_COOKIE, readSessionToken } from '@/lib/server/auth/owner-method';
import { getSessionUser } from '@/lib/server/auth/store';

export const runtime = 'nodejs';

/** `GET /api/auth/session`: the signed-in account, or `{ user: null }`. Clears a stale cookie. */
export async function GET(request: Request): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (!process.env.DATABASE_URL?.trim()) return Response.json({ user: null }, { headers });
  const token = readSessionToken(request.headers);
  if (!token) return Response.json({ user: null }, { headers });
  const user = await getSessionUser(token).catch(() => undefined);
  if (!user) {
    headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    return Response.json({ user: null }, { headers });
  }
  return Response.json({ user: { email: user.email, name: user.name } }, { headers });
}
