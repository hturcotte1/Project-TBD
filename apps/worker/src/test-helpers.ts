/**
 * Test-only harness: a real Postgres DB (truncated + reseeded with the demo student), fakes for
 * every adapter that has one, a real local Chromium session provider, and a mock Common App
 * server on a random port. Not a `*.test.ts` file itself, so vitest never picks it up as a suite.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createCommonAppClient,
  defaultMockState,
  LocalChromiumSessionProvider,
  startMockCommonApp,
  type MockAccountState,
  type MockCommonAppHandle,
} from '@tbd/browser';
import { RuleBasedFakeLLM } from '@tbd/agent';
import { FakeMessagingProvider } from '@tbd/messaging';
import { loadEnv } from '@tbd/shared/config';
import { parseKeyRing } from '@tbd/shared/crypto';
import { LocalDiskStorageProvider, MemoryVerificationCodeChannel } from '@tbd/shared/adapters';
import { MemoryJobEnqueuer } from '@tbd/shared/jobs';
import { createLogger } from '@tbd/shared/logging';
import { DEMO_STUDENT, seedDemoStudent } from '@tbd/shared/seed';
import { closeTestDb, getTestDb, truncateAll } from '@tbd/shared/testing';
import { FixedClock } from '@tbd/shared/time';
import type { WorkerDeps } from './deps';

export const DEMO_SEED_NOW = new Date('2026-09-01T15:00:00Z');

// The whole worker test suite shares one Postgres test DB that every harness truncates and
// reseeds with the (single, fixed-identity) demo student. Vitest's file/hook sequencing alone has
// not proven reliable enough in this environment to guarantee that never overlaps, so this module
// enforces it directly: `acquireDbLock` hands out a strictly one-at-a-time ticket, and
// `setupWorkerTest`'s returned `close()` is the only thing that releases it. A test file that
// touches the shared DB without going through `setupWorkerTest` (see `src/scheduler/tick.test.ts`)
// must wrap its own body in `acquireDbLock`/release the same way.
let dbLockChain: Promise<void> = Promise.resolve();

/** Waits for exclusive use of the shared test DB and returns the function that releases it. Every
 * acquire MUST be matched by exactly one release (in a `finally`), or every later test hangs. */
export async function acquireDbLock(): Promise<() => void> {
  let release!: () => void;
  const ticket = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = dbLockChain;
  dbLockChain = ticket;
  await previous;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
  };
}

export interface WorkerTestHarness {
  deps: WorkerDeps;
  clock: FixedClock;
  enqueuer: MemoryJobEnqueuer;
  codeChannel: MemoryVerificationCodeChannel;
  messaging: FakeMessagingProvider;
  storage: LocalDiskStorageProvider;
  mock: MockCommonAppHandle;
  studentId: string;
  adminId: string;
  close(): Promise<void>;
}

export interface SetupOptions {
  now?: string | Date;
  mockState?: MockAccountState;
  verificationTimeoutMs?: number;
  /** When false, the mock Common App server is not started (some tests point the client at a
   * closed port on purpose, to force a login failure). */
  startMock?: boolean;
}

function randomPort(): number {
  return 41000 + Math.floor(Math.random() * 8000);
}

export async function setupWorkerTest(opts: SetupOptions = {}): Promise<WorkerTestHarness> {
  const releaseDbLock = await acquireDbLock();
  try {
    return await buildHarness(opts, releaseDbLock);
  } catch (err) {
    // A harness that never finished building never hands back a `close()` to release the lock —
    // release it here so a failed setup doesn't wedge every test queued behind it.
    releaseDbLock();
    throw err;
  }
}

/** True for the foreign-key-violation shape Postgres reports when a row this transaction just
 * read/inserted was concurrently truncated out from under it. */
function isConcurrentTruncateError(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } } | undefined)?.cause?.code ?? (err as { code?: string } | undefined)?.code;
  return code === '23503';
}

/** Runs `fn` (expected to itself call `truncateAll` first) with a bounded retry against the
 * concurrent-truncate FK-violation shape. `acquireDbLock` should already make that impossible for
 * callers that hold it for their whole DB-touching span, but this test DB is also shared with
 * whatever else the environment runs outside this suite — one bounded retry absorbs a genuinely
 * external collision without masking a real seeding bug. Exported for test files (e.g.
 * `src/scheduler/tick.test.ts`) that build their own fixtures instead of using `setupWorkerTest`. */
export async function withTruncateRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !isConcurrentTruncateError(err)) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  throw new Error('unreachable');
}

async function buildHarness(opts: SetupOptions, releaseDbLock: () => void): Promise<WorkerTestHarness> {
  const db = await getTestDb();
  const { studentId, adminId } = await withTruncateRetry(async () => {
    await truncateAll(db);
    return seedDemoStudent(db, { now: DEMO_SEED_NOW });
  });

  const env = loadEnv();
  const logger = createLogger({ name: 'worker-test', level: 'silent' });
  const clock = new FixedClock(opts.now ?? '2026-09-04T15:00:00Z');
  const enqueuer = new MemoryJobEnqueuer();
  const codeChannel = new MemoryVerificationCodeChannel();
  const messaging = new FakeMessagingProvider({ logger });
  const tmpDir = await mkdtemp(join(tmpdir(), 'tbd-worker-test-'));
  const storage = new LocalDiskStorageProvider(tmpDir, 'http://localhost:4000');
  const llm = new RuleBasedFakeLLM();
  const keyRing = parseKeyRing(env.CREDENTIALS_ENCRYPTION_KEYS, env.CREDENTIALS_ENCRYPTION_KEY_VERSION);

  const port = randomPort();
  let mock: MockCommonAppHandle;
  let baseUrl: string;
  if (opts.startMock ?? true) {
    mock = await startMockCommonApp({ port, state: opts.mockState ?? defaultMockState(), logger });
    baseUrl = mock.url;
  } else {
    // Nothing listens here: used by tests that need every login attempt to fail with a connection error.
    baseUrl = `http://127.0.0.1:${port}`;
    mock = { url: baseUrl, port, getState: () => defaultMockState(), setState: () => undefined, reset: () => undefined, close: async () => undefined };
  }

  const sessions = new LocalChromiumSessionProvider({ executablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true });
  const browser = createCommonAppClient({ baseUrl, logger, fallback: null, recordFixtures: null });

  const deps: WorkerDeps = {
    db,
    llm,
    messaging,
    enqueuer,
    storage,
    codeChannel,
    clock,
    logger,
    env,
    browser,
    sessions,
    keyRing,
    verificationTimeoutMs: opts.verificationTimeoutMs ?? 10 * 60 * 1000,
  };

  return {
    deps,
    clock,
    enqueuer,
    codeChannel,
    messaging,
    storage,
    mock,
    studentId,
    adminId,
    close: async () => {
      try {
        await mock.close();
      } finally {
        releaseDbLock();
      }
    },
  };
}

export { DEMO_STUDENT, closeTestDb };
