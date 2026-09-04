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
  const db = await getTestDb();
  await truncateAll(db);
  const { studentId, adminId } = await seedDemoStudent(db, { now: DEMO_SEED_NOW });

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
      await mock.close();
    },
  };
}

export { DEMO_STUDENT, closeTestDb };
