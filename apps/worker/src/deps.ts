/**
 * `WorkerDeps`: every adapter a job handler needs. Extends `@apogee/agent`'s `AgentDeps` (db, llm,
 * messaging, enqueuer, storage, codeChannel, clock, logger, env) with the browser-automation
 * pieces only the worker uses. `createWorkerDeps` wires the real adapters for `src/index.ts`;
 * tests build a `WorkerDeps` by hand from fakes instead of calling this.
 */
import Redis from 'ioredis';
import type { AgentDeps } from '@apogee/agent';
import { createLLMProvider } from '@apogee/agent';
import type { BrowserSessionProvider, CommonAppClient, MockCommonAppHandle } from '@apogee/browser';
import { createBrowserSessionProvider, createCommonAppClient, createFallbackExtractor, defaultMockState, startMockCommonApp } from '@apogee/browser';
import { createDb } from '@apogee/shared/db';
import { LocalDiskStorageProvider, RedisVerificationCodeChannel, S3StorageProvider } from '@apogee/shared/adapters';
import type { StorageProvider } from '@apogee/shared/adapters';
import { BullJobEnqueuer } from '@apogee/shared/jobs';
import type { Env } from '@apogee/shared/config';
import { parseKeyRing } from '@apogee/shared/crypto';
import type { KeyRing } from '@apogee/shared/crypto';
import { SystemClock } from '@apogee/shared/time';
import type { Logger } from '@apogee/shared/logging';
import { createMessagingProvider } from '@apogee/messaging';

/** The verification-code wait is normally 10 minutes; tests override it to run fast. */
export const DEFAULT_VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000;

export interface WorkerDeps extends AgentDeps {
  browser: CommonAppClient;
  sessions: BrowserSessionProvider;
  keyRing: KeyRing;
  /** How long a browser job waits for a verification code before giving up. Overridable in tests. */
  verificationTimeoutMs: number;
}

function buildStorage(env: Env): StorageProvider {
  if (env.STORAGE_PROVIDER === 's3') {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error('STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY');
    }
    return new S3StorageProvider({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    });
  }
  return new LocalDiskStorageProvider(env.STORAGE_LOCAL_DIR, env.API_URL);
}

/** True when `EADDRINUSE` (or similar) is thrown for the given port — another process already
 * bound it, most likely a previously started mock Common App we should just talk to instead. */
function isAddressInUseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'EADDRINUSE';
}

export interface CreatedWorkerDeps {
  deps: WorkerDeps;
  /** The concrete enqueuer (same object as `deps.enqueuer`), typed so `src/index.ts` can reach
   * `.queue()` to register the repeatable `scheduler.tick` job. */
  enqueuer: BullJobEnqueuer;
  /** BullMQ needs its own connections (a shared one for enqueueing, a factory for BLPOP/Workers). */
  redis: { connection: Redis; makeBlockingConnection: () => Redis };
  mock: MockCommonAppHandle | null;
  close(): Promise<void>;
}

/** Wires every real adapter from `env`. Called once by `src/index.ts`. */
export async function createWorkerDeps(env: Env, logger: Logger): Promise<CreatedWorkerDeps> {
  const dbHandle = createDb(env.DATABASE_URL);
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const makeBlockingConnection = (): Redis => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const enqueuer = new BullJobEnqueuer(connection);
  const messaging = createMessagingProvider(env, { redis: connection, logger });
  const storage = buildStorage(env);
  const codeChannel = new RedisVerificationCodeChannel(connection, makeBlockingConnection);
  const llm = createLLMProvider(env, logger);
  const sessions = createBrowserSessionProvider(env);

  let mock: MockCommonAppHandle | null = null;
  if (env.MOCK_COMMONAPP) {
    try {
      mock = await startMockCommonApp({ port: env.COMMONAPP_MOCK_PORT, state: buildMockState(env), logger });
    } catch (err) {
      if (!isAddressInUseError(err)) throw err;
      logger.warn({ port: env.COMMONAPP_MOCK_PORT }, 'mock Common App port already bound; assuming another process is serving it');
    }
  }

  const browser = createCommonAppClient({
    baseUrl: env.COMMONAPP_BASE_URL,
    logger,
    fallback: createFallbackExtractor(env, logger),
    recordFixtures: env.RECORD_FIXTURES ? { dir: 'packages/browser/fixtures/recorded' } : null,
  });

  const keyRing = parseKeyRing(env.CREDENTIALS_ENCRYPTION_KEYS, env.CREDENTIALS_ENCRYPTION_KEY_VERSION);

  const deps: WorkerDeps = {
    db: dbHandle.db,
    llm,
    messaging,
    enqueuer,
    storage,
    codeChannel,
    clock: new SystemClock(),
    logger,
    env,
    browser,
    sessions,
    keyRing,
    verificationTimeoutMs: DEFAULT_VERIFICATION_TIMEOUT_MS,
  };

  return {
    deps,
    enqueuer,
    redis: { connection, makeBlockingConnection },
    mock,
    close: async () => {
      await mock?.close();
      await enqueuer.close();
      await dbHandle.close();
      connection.disconnect();
    },
  };
}

/** The mock's default state already matches the demo student; only the verification code (a
 * secret, not part of the demo fixture) is layered on from env. */
function buildMockState(env: Env) {
  const state = defaultMockState();
  if (env.COMMONAPP_MOCK_VERIFICATION_CODE) state.account.verificationCode = env.COMMONAPP_MOCK_VERIFICATION_CODE;
  return state;
}
