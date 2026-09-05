import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { defaultMockState } from '@tbd/browser';
import * as S from '@tbd/shared/db/schema';
import { browserJobsRepo, credentialsRepo, scoped } from '@tbd/shared/db';
import type { BrowserJobResult } from '@tbd/shared/schemas';
import { dispatch } from '../../dispatch';
import { closeTestDb, setupWorkerTest, type WorkerTestHarness } from '../../test-helpers';

async function waitForStatus(harness: WorkerTestHarness, jobId: string, status: string, timeoutMs: number): Promise<void> {
  const sdb = scoped(harness.deps.db, harness.studentId);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, jobId));
    if (row.status === status) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for browser job ${jobId} to reach status "${status}" (was "${row.status}")`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe('verification-code pause/resume', () => {
  let harness: WorkerTestHarness;

  beforeAll(async () => {
    const state = defaultMockState();
    state.account.verificationCode = '246810';
    harness = await setupWorkerTest({ mockState: state, verificationTimeoutMs: 30_000 });
  }, 60_000);

  afterAll(async () => {
    await harness.close();
    await closeTestDb();
  });

  it('pauses for a verification code, texts exactly once, then resumes when the code is published', async () => {
    harness.deps.verificationTimeoutMs = 30_000;
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });

    const promise = dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' });
    await waitForStatus(harness, job.id, 'awaiting_verification_code', 20_000);

    const codeTexts = harness.messaging.sent.filter((m) => m.body.includes('Common App just sent you a code'));
    expect(codeTexts).toHaveLength(1);

    await deps.codeChannel.publish(job.id, '246810');
    const result = (await promise) as BrowserJobResult;
    expect(result.login_ok).toBe(true);
    expect(result.verification_requested).toBe(true);

    // The code must never be persisted anywhere.
    const jobRow = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(jobRow.status).toBe('succeeded');
    expect(JSON.stringify(jobRow)).not.toContain('246810');
    const auditRows = await sdb.select(S.auditLog);
    expect(auditRows.some((a) => JSON.stringify(a.details).includes('246810'))).toBe(false);
    const messageRows = await sdb.select(S.messages);
    expect(messageRows.every((m) => !m.body.includes('246810'))).toBe(true);
  }, 120_000);

  it('fails after the verification timeout: one text, no retry', async () => {
    harness.deps.verificationTimeoutMs = 1_500;
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);
    // The previous test's successful login remembered this device (a cookie in the stored
    // session); clear it so this login has to ask for a code again.
    await credentialsRepo.storeSession(sdb, deps.keyRing, 'common_app', null);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });

    let caught: unknown;
    try {
      await dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnrecoverableError);

    const jobRow = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(jobRow.status).toBe('failed');

    const timeoutTexts = harness.messaging.sent.filter((m) => m.body.includes("didn't get the code in time"));
    expect(timeoutTexts).toHaveLength(1);
  }, 60_000);
});
