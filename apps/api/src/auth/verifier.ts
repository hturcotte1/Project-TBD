/**
 * `AuthVerifier` turns a bearer token into `{ authUserId, email }` or null. Two implementations:
 * `DevAuthVerifier` (AUTH_MODE=dev, HMAC token) and `ClerkAuthVerifier` (AUTH_MODE=clerk).
 */
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import { verifyDevToken } from '@apogee/shared/auth';
import type { Env } from '@apogee/shared/config';
import type { Logger } from '@apogee/shared/logging';

export interface VerifiedAuth {
  authUserId: string;
  email: string;
}

export interface AuthVerifier {
  verify(token: string): Promise<VerifiedAuth | null>;
}

export class DevAuthVerifier implements AuthVerifier {
  constructor(private readonly secret: string) {}

  async verify(token: string): Promise<VerifiedAuth | null> {
    const claims = verifyDevToken(token, this.secret);
    if (!claims) return null;
    return { authUserId: claims.sub, email: claims.email };
  }
}

const EMAIL_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedEmail {
  email: string;
  expiresAt: number;
}

export class ClerkAuthVerifier implements AuthVerifier {
  private readonly client: ClerkClient;
  private readonly emailCache = new Map<string, CachedEmail>();

  constructor(
    private readonly secretKey: string,
    private readonly logger: Logger,
  ) {
    this.client = createClerkClient({ secretKey });
  }

  async verify(token: string): Promise<VerifiedAuth | null> {
    let payload: Awaited<ReturnType<typeof verifyToken>>;
    try {
      payload = await verifyToken(token, { secretKey: this.secretKey });
    } catch (err) {
      this.logger.warn({ err }, 'clerk: token verification failed');
      return null;
    }
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) return null;

    const cached = this.emailCache.get(sub);
    if (cached && cached.expiresAt > Date.now()) return { authUserId: sub, email: cached.email };

    try {
      const user = await this.client.users.getUser(sub);
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
      if (!email) return null;
      this.emailCache.set(sub, { email, expiresAt: Date.now() + EMAIL_CACHE_TTL_MS });
      return { authUserId: sub, email };
    } catch (err) {
      this.logger.warn({ err }, 'clerk: user lookup failed');
      return null;
    }
  }
}

export function buildAuthVerifier(env: Env, logger: Logger): AuthVerifier {
  if (env.AUTH_MODE === 'clerk') {
    if (!env.CLERK_SECRET_KEY) throw new Error('AUTH_MODE=clerk requires CLERK_SECRET_KEY');
    return new ClerkAuthVerifier(env.CLERK_SECRET_KEY, logger);
  }
  return new DevAuthVerifier(env.DEV_AUTH_SECRET);
}
