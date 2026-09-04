import type { Redis } from 'ioredis';

/**
 * One-shot channel that carries a Common App verification code from the agent (who received it
 * in a text) to the browser job that is waiting for it. Codes live only in memory/Redis with a
 * short TTL and are deleted on first read. They are never written to Postgres or logs.
 */
export interface VerificationCodeChannel {
  publish(browserJobId: string, code: string): Promise<void>;
  /** Resolve with the code, or null on timeout/abort. Consumes the code. */
  waitFor(browserJobId: string, timeoutMs: number, signal?: AbortSignal): Promise<string | null>;
  clear(browserJobId: string): Promise<void>;
}

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export class MemoryVerificationCodeChannel implements VerificationCodeChannel {
  private codes = new Map<string, { code: string; expiresAt: number }>();
  private waiters = new Map<string, (code: string) => void>();

  async publish(jobId: string, code: string): Promise<void> {
    const waiter = this.waiters.get(jobId);
    if (waiter) {
      this.waiters.delete(jobId);
      waiter(code);
      return;
    }
    this.codes.set(jobId, { code, expiresAt: Date.now() + VERIFICATION_CODE_TTL_MS });
  }

  async waitFor(jobId: string, timeoutMs: number, signal?: AbortSignal): Promise<string | null> {
    const existing = this.codes.get(jobId);
    if (existing) {
      this.codes.delete(jobId);
      if (existing.expiresAt > Date.now()) return existing.code;
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(jobId);
        resolve(null);
      }, timeoutMs);
      const onAbort = () => {
        clearTimeout(timer);
        this.waiters.delete(jobId);
        resolve(null);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.set(jobId, (code) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(code);
      });
    });
  }

  async clear(jobId: string): Promise<void> {
    this.codes.delete(jobId);
    this.waiters.delete(jobId);
  }
}

/** Redis list per job: publish = RPUSH + PEXPIRE, wait = BLPOP with a short loop so aborts are honoured. */
export class RedisVerificationCodeChannel implements VerificationCodeChannel {
  constructor(
    private readonly redis: Redis,
    private readonly makeBlockingClient: () => Redis,
  ) {}

  private key(jobId: string): string {
    return `vcode:${jobId}`;
  }

  async publish(jobId: string, code: string): Promise<void> {
    const k = this.key(jobId);
    await this.redis.multi().del(k).rpush(k, code).pexpire(k, VERIFICATION_CODE_TTL_MS).exec();
  }

  async waitFor(jobId: string, timeoutMs: number, signal?: AbortSignal): Promise<string | null> {
    const blocking = this.makeBlockingClient();
    const deadline = Date.now() + timeoutMs;
    try {
      while (Date.now() < deadline && !signal?.aborted) {
        const slice = Math.min(5, Math.max(1, Math.ceil((deadline - Date.now()) / 1000)));
        const res = await blocking.blpop(this.key(jobId), slice);
        if (res && res[1]) {
          await this.redis.del(this.key(jobId));
          return res[1];
        }
      }
      return null;
    } finally {
      blocking.disconnect();
    }
  }

  async clear(jobId: string): Promise<void> {
    await this.redis.del(this.key(jobId));
  }
}
