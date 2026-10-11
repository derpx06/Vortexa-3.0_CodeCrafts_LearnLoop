/**
 * Google OAuth credentials for Vertex AI's OpenAI-compatible endpoint.
 *
 * The OpenAI-compatible Vertex endpoint accepts a short-lived OAuth access
 * token as its bearer credential. The deployment config stores only a marker
 * such as `vertex-oauth-file:service.json`; this module reads the credential
 * file on the server and refreshes the token when it is close to expiry.
 */

const CREDENTIAL_REF_PREFIX = 'vertex-oauth-file:';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REFRESH_MARGIN_MS = 60_000;

interface AuthorizedUserCredential {
  type: 'authorized_user';
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const tokenRequests = new Map<string, Promise<string>>();

export function isVertexOAuthCredentialRef(value: string | undefined): boolean {
  return value?.startsWith(CREDENTIAL_REF_PREFIX) === true;
}

function credentialPathFromRef(value: string): string {
  return value.slice(CREDENTIAL_REF_PREFIX.length).trim();
}

async function readCredential(pathname: string): Promise<AuthorizedUserCredential> {
  // This module is imported by the shared provider registry, so keep Node-only
  // modules behind runtime imports. The function is only reached on the server
  // for an operator-configured Vertex OAuth provider.
  const [{ readFile }, { resolve }] = await Promise.all([
    import(/* webpackIgnore: true */ 'node:fs/promises'),
    import(/* webpackIgnore: true */ 'node:path'),
  ]);
  const raw = await readFile(resolve(process.cwd(), pathname), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Vertex OAuth credential file is not a JSON object');
  }
  const credential = parsed as Partial<AuthorizedUserCredential>;
  if (
    credential.type !== 'authorized_user' ||
    !credential.client_id ||
    !credential.client_secret ||
    !credential.refresh_token
  ) {
    throw new Error('Vertex OAuth credential file must contain authorized_user credentials');
  }
  return credential as AuthorizedUserCredential;
}

async function refreshAccessToken(pathname: string): Promise<string> {
  const credential = await readCredential(pathname);
  const body = new URLSearchParams({
    client_id: credential.client_id,
    client_secret: credential.client_secret,
    refresh_token: credential.refresh_token,
    grant_type: 'refresh_token',
    scope: CLOUD_PLATFORM_SCOPE,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Vertex OAuth token refresh failed (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new Error('Vertex OAuth token refresh returned no access token');
  }
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  tokenCache.set(pathname, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return payload.access_token;
}

async function accessTokenFor(pathname: string): Promise<string> {
  const cached = tokenCache.get(pathname);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cached.accessToken;
  }
  const pending = tokenRequests.get(pathname);
  if (pending) return pending;
  const request = refreshAccessToken(pathname).finally(() => tokenRequests.delete(pathname));
  tokenRequests.set(pathname, request);
  return request;
}

/** Wraps the normal OpenMAIC transport with a refreshed Vertex bearer token. */
export function withVertexOAuth(
  credentialRef: string,
  transport: typeof fetch,
): typeof fetch {
  const pathname = credentialPathFromRef(credentialRef);
  if (!pathname) throw new Error('Vertex OAuth credential file path is empty');
  return async (input, init) => {
    const accessToken = await accessTokenFor(pathname);
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${accessToken}`);
    headers.delete('x-api-key');
    return transport(input, { ...init, headers });
  };
}
