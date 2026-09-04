import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Dev-mode auth token: `dev.<base64url(json)>.<hmac>`. The web app sets it as a cookie and passes it
 * as a bearer token; the API verifies it with DEV_AUTH_SECRET. Never enabled when AUTH_MODE=clerk.
 */
export interface DevTokenClaims {
  sub: string;
  email: string;
  exp: number;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createDevToken(claims: Omit<DevTokenClaims, 'exp'> & { exp?: number }, secret: string, ttlSeconds = 30 * 24 * 3600): string {
  const full: DevTokenClaims = { ...claims, exp: claims.exp ?? Math.floor(Date.now() / 1000) + ttlSeconds };
  const payload = b64url(JSON.stringify(full));
  return `dev.${payload}.${sign(payload, secret)}`;
}

export function verifyDevToken(token: string, secret: string, now = Date.now()): DevTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'dev') return null;
  const payload = parts[1] ?? '';
  const expected = sign(payload, secret);
  const given = parts[2] ?? '';
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DevTokenClaims;
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || typeof claims.exp !== 'number') return null;
    if (claims.exp * 1000 < now) return null;
    return claims;
  } catch {
    return null;
  }
}
