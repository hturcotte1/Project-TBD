import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import * as S from '@tbd/shared/db/schema';
import { approvalsRepo, browserJobsRepo, scoped } from '@tbd/shared/db';
import { buildActivitiesFillPayload } from '@tbd/shared/domain';
import type { BrowserJobResult, FillFieldsPayload } from '@tbd/shared/schemas';
import { dispatch } from '../../dispatch';
import { closeTestDb, setupWorkerTest, type WorkerTestHarness } from '../../test-helpers';

describe('browser.fill_fields', () => {
  let harness: WorkerTestHarness;

  beforeAll(async () => {
    harness = await setupWorkerTest();
  }, 60_000);

  afterAll(async () => {
    await harness.close();
    await closeTestDb();
  });

  it('fills every activity (including the two profile-only ones) and verifies each field', async () => {
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);

    const activities = await sdb.select(S.activities);
    expect(activities).toHaveLength(8);
    const payload = buildActivitiesFillPayload(activities);

    const approval = await approvalsRepo.create(sdb, { kind: 'fill_fields', summary: 'Fill activities', payload, requestedVia: 'imessage' });
    await approvalsRepo.answer(sdb, approval.id, { approve: true, via: 'imessage' });

    const job = await browserJobsRepo.create(sdb, { kind: 'fill_fields', provider: 'local', approvalId: approval.id });
    const result = (await dispatch(deps, 'browser.fill_fields', { studentId, browserJobId: job.id, approvalId: approval.id })) as BrowserJobResult;

    expect(result.fill_verifications.length).toBeGreaterThan(0);
    expect(result.fill_verifications.every((v) => v.matched)).toBe(true);

    const approvalRow = await sdb.requireOne(S.approvals, eq(S.approvals.id, approval.id));
    expect(approvalRow.status).toBe('executed');

    const auditRows = await sdb.select(S.auditLog);
    const completedAudit = auditRows.find((a) => a.action === 'fill.completed');
    expect(completedAudit).toBeDefined();
    const screenshotKeys = (completedAudit?.details as { screenshot_keys?: unknown[] } | undefined)?.screenshot_keys ?? [];
    expect(Array.isArray(screenshotKeys)).toBe(true);
    expect(screenshotKeys.length).toBeGreaterThan(0);

    expect(harness.messaging.sent.some((m) => m.body.startsWith('Done —') && m.body.includes('activit'))).toBe(true);
  }, 120_000);

  it('blocks a fill payload that targets a submit action, fails the job, and leaves the mock unchanged', async () => {
    const { deps, studentId, mock } = harness;
    const sdb = scoped(deps.db, studentId);

    const before = JSON.stringify(mock.getState().colleges.find((c) => c.slug === 'umich'));

    const badPayload: FillFieldsPayload = {
      kind: 'fill_fields',
      section: 'college_questions',
      school_slug: 'umich',
      fields: [{ path: 'questions.confirm', label: 'Submit application', value: 'true' }],
      origin: 'student_message',
    };
    const approval = await approvalsRepo.create(sdb, { kind: 'fill_fields', summary: 'Submit umich', payload: badPayload, requestedVia: 'imessage' });
    await approvalsRepo.answer(sdb, approval.id, { approve: true, via: 'imessage' });

    const job = await browserJobsRepo.create(sdb, { kind: 'fill_fields', provider: 'local', approvalId: approval.id });
    let caught: unknown;
    try {
      await dispatch(deps, 'browser.fill_fields', { studentId, browserJobId: job.id, approvalId: approval.id });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnrecoverableError);

    const jobRow = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(jobRow.status).toBe('failed');

    const approvalRow = await sdb.requireOne(S.approvals, eq(S.approvals.id, approval.id));
    expect(approvalRow.status).toBe('failed');

    const auditRows = await sdb.select(S.auditLog);
    expect(auditRows.some((a) => a.action === 'fill.blocked_by_guard')).toBe(true);

    const after = JSON.stringify(mock.getState().colleges.find((c) => c.slug === 'umich'));
    expect(after).toBe(before);
  }, 120_000);
});
