import { eq } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import * as S from '@tbd/shared/db/schema';
import { browserJobsRepo, credentialsRepo, scoped } from '@tbd/shared/db';
import type { BrowserJobResult } from '@tbd/shared/schemas';
import { dispatch } from '../../dispatch';
import { closeTestDb, setupWorkerTest, type WorkerTestHarness } from '../../test-helpers';

describe('browser.verify_credentials', () => {
  let harness: WorkerTestHarness | null = null;

  afterEach(async () => {
    await harness?.close();
    harness = null;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('succeeds with the right password: job succeeded, credentials verified, connected text, full_sync enqueued', async () => {
    harness = await setupWorkerTest();
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'verify_credentials', provider: 'local' });

    const result = (await dispatch(deps, 'browser.verify_credentials', { studentId, browserJobId: job.id })) as BrowserJobResult;
    expect(result.login_ok).toBe(true);

    const row = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(row.status).toBe('succeeded');

    const credStatus = await credentialsRepo.status(sdb, 'common_app');
    expect(credStatus?.status).toBe('active');
    expect(credStatus?.verifiedAt).not.toBeNull();

    expect(harness.messaging.sent.some((m) => m.body.includes("You're connected"))).toBe(true);

    const syncJobs = harness.enqueuer.ofName('browser.full_sync');
    expect(syncJobs).toHaveLength(1);
    expect(syncJobs[0]?.payload.studentId).toBe(studentId);
    expect(syncJobs[0]?.payload.reason).toBe('verification');
  }, 60_000);

  it('fails with the wrong password: job failed, credentials invalid, no connected text', async () => {
    harness = await setupWorkerTest();
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);
    await credentialsRepo.store(sdb, deps.keyRing, 'common_app', 'demo@example.com', 'not-the-right-password');

    const job = await browserJobsRepo.create(sdb, { kind: 'verify_credentials', provider: 'local' });
    await expect(dispatch(deps, 'browser.verify_credentials', { studentId, browserJobId: job.id })).rejects.toThrow();

    const row = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(row.status).toBe('failed');

    const credStatus = await credentialsRepo.status(sdb, 'common_app');
    expect(credStatus?.status).toBe('invalid');
    expect(credStatus?.failureCount).toBeGreaterThan(0);

    expect(harness.messaging.sent.some((m) => m.body.includes("You're connected"))).toBe(false);
    expect(harness.enqueuer.ofName('browser.full_sync')).toHaveLength(0);
  }, 60_000);
});
