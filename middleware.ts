import { NextRequest, NextResponse } from 'next/server';

import { isAgentRuntimeConfigured, isProWorkbenchEnabled } from '@/lib/config/feature-flags';
import { verifyAccessTokenEdge } from '@/lib/server/access-token-edge';
import {
  anonymousOwnerForNavigation,
  type NavigationIdentity,
} from '@/lib/server/identity/navigation';

/**
 * Let the request through, carrying the anonymous owner a page request
 * establishes: the cookie is set on the page response, and the forwarded
 * request carries it too, so the page and every request it sends resolve one
 * owner (see `lib/server/identity/navigation.ts`).
 */
function next(request: NextRequest, identity: NavigationIdentity | undefined): NextResponse {
  if (!identity) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set('cookie', identity.requestCookie);
  const response = NextResponse.next({ request: { headers } });
  response.headers.append('set-cookie', identity.setCookie);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Return an actual server-side 404 when either half of the workbench is off.
  // Edge middleware cannot reliably inspect server-only deployment variables,
  // so it enforces the public gate and leaves the complete runtime/database
  // check to Node. A Node-hosted middleware uses the same gate as startup.
  const canInspectServerRuntime = process.env.NEXT_RUNTIME !== 'edge';
  const workbenchEnabled =
    isProWorkbenchEnabled() && (!canInspectServerRuntime || isAgentRuntimeConfigured());
  if (!workbenchEnabled && (pathname === '/workbench' || pathname.startsWith('/workbench/'))) {
    return new NextResponse('Not found', { status: 404 });
  }

  // One anonymous owner per browser, established on the page response before
  // any API request can mint its own.
  const identity = anonymousOwnerForNavigation({
    method: request.method,
    headers: request.headers,
    pathname,
  });

  // Account sign-in is compulsory: without a session cookie, pages redirect to
  // `/login` and API calls answer 401. Presence is checked here (Edge cannot
  // reach the database); a stale cookie is caught by the account auth method
  // and cleared by `GET /api/auth/session` on the next refresh.
  const SESSION_COOKIE = 'learnloop_session';
  const AUTH_OPEN = (p: string) =>
    p === '/login' ||
    p.startsWith('/login/') ||
    p === '/signup' ||
    p.startsWith('/signup/') ||
    p === '/api/auth/session' ||
    p.startsWith('/api/access-code/') ||
    p === '/api/health' ||
    // Next's own internals (dev HMR socket, font loader) must work signed out.
    p.startsWith('/_next/') ||
    p.startsWith('/__nextjs') ||
    // Public static files served from `public/` carry an extension; let them
    // through so the sign-in page can load its own logo and other assets.
    /\.[a-z0-9]+$/i.test(p);
  if (!request.cookies.get(SESSION_COOKIE)?.value && !AUTH_OPEN(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, errorCode: 'INVALID_CREDENTIAL', error: 'Sign-in required' },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return next(request, identity);
  }

  // Whitelist: access-code endpoints, health check, auth surfaces
  if (
    pathname.startsWith('/api/access-code/') ||
    pathname === '/api/health' ||
    AUTH_OPEN(pathname)
  ) {
    return next(request, identity);
  }

  // Check cookie — validate HMAC signature, not just existence
  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyAccessTokenEdge(cookie.value, accessCode))) {
    return next(request, identity);
  }

  // API requests without valid cookie → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Access code required' },
      { status: 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return next(request, identity);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
