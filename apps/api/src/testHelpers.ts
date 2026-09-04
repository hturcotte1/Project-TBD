/**
 * Test-only helper: builds a fully wired `buildApp()` instance against the test database, with
 * fake/in-memory adapters everywhere (`MemoryJobEnqueuer`, `MemoryVerificationCodeChannel`,
 * `FakeMessagingProvider`, `LocalDiskStorageProvider` in a temp dir). Not a `*.test.ts` file
 * itself, so vitest never collects it as a test suite; test files import from here.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createDevToken } from '@tbd/shared/auth';
import { LocalDiskStorageProvider, MemoryVerificationCodeChannel } from '@tbd/shared/adapters';
import { loadEnv, resetEnvCache } from '@tbd/shared/config';
import { studentsRepo } from '@tbd/shared/db';
import { createLogger } from '@tbd/shared/logging';
import { MemoryJobEnqueuer } from '@tbd/shared/jobs';
import { createTestStudent, getTestDb, truncateAll } from '@tbd/shared/testing';
import { FixedClock } from '@tbd/shared/time';
import { FakeMessagingProvider } from '@tbd/messaging';
import { buildApp } from './app';
import type { ApiDeps } from './deps';

/** `deps.enqueuer` is narrowed to `MemoryJobEnqueuer` (its actual runtime type in tests) so test
 * files can call `.ofName(...)`/`.drain()` without casting. */
export interface TestApp {
  app: FastifyInstance;
  deps: Omit<ApiDeps, 'enqueuer'> & { enqueuer: MemoryJobEnqueuer };
  studentId: string;
  /** Bearer token for any existing student row (looked up by id each call). */
  token: (studentId: string) => Promise<string>;
}

function setTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_MODE = 'dev';
  process.env.DEV_AUTH_SECRET = 'test-secret-at-least-8-chars';
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.MESSAGING_PROVIDER = 'fake';
  process.env.STORAGE_PROVIDER = 'local';
  process.env.LOG_LEVEL = 'silent';
  process.env.AUTONOMY_LEVEL = process.env.AUTONOMY_LEVEL ?? 'B';
  resetEnvCache();
}

export interface MakeTestAppOptions {
  now?: string;
}

/** A phone number unique enough to never collide across concurrently-running test files —
 * `createTestStudent`'s own random default collapses to a small set of values far too often for
 * a shared, non-isolated test database. */
function uniquePhone(): string {
  let digits = '';
  while (digits.length < 7) digits += Math.floor(Math.random() * 10).toString();
  return `+1555${digits}`;
}

export async function makeTestApp(opts: MakeTestAppOptions = {}): Promise<TestApp> {
  setTestEnv();
  const env = loadEnv();
  const db = await getTestDb();
  await truncateAll(db);

  const tmpDir = await mkdtemp(join(tmpdir(), 'tbd-api-test-'));
  const storage = new LocalDiskStorageProvider(tmpDir, env.API_URL);
  const enqueuer = new MemoryJobEnqueuer();
  const codeChannel = new MemoryVerificationCodeChannel();
  const messaging = new FakeMessagingProvider({});
  const clock = new FixedClock(opts.now ?? '2026-09-04T12:00:00.000Z');
  const logger = createLogger({ name: 'api-test', level: 'silent' });

  const deps = { db, env, logger, enqueuer, messaging, storage, codeChannel, redis: null, clock };
  const app = buildApp(deps);
  await app.ready();

  const student = await createTestStudent(db, { phoneE164: uniquePhone() });

  async function token(studentId: string): Promise<string> {
    const row = await studentsRepo.findById(db, studentId);
    if (!row || !row.authUserId) throw new Error(`no authUserId for student ${studentId}`);
    return createDevToken({ sub: row.authUserId, email: row.email }, env.DEV_AUTH_SECRET);
  }

  return { app, deps, studentId: student.id, token };
}

export function authHeader(tok: string): { authorization: string } {
  return { authorization: `Bearer ${tok}` };
}

/** A student authenticated as an admin (email in ADMIN_EMAILS). */
export async function createAdmin(deps: ApiDeps): Promise<{ id: string; token: string }> {
  const authUserId = `dev:admin-${randomUUID()}`;
  const student = await createTestStudent(deps.db, { authUserId, email: 'admin@example.com', role: 'admin', phoneE164: null });
  const tok = createDevToken({ sub: authUserId, email: 'admin@example.com' }, deps.env.DEV_AUTH_SECRET);
  return { id: student.id, token: tok };
}
