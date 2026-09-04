import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as S from '@tbd/shared/db/schema';
import { browserJobsRepo, scoped } from '@tbd/shared/db';
import type { BrowserJobResult } from '@tbd/shared/schemas';
import { dispatch } from '../../dispatch';
import { closeTestDb, setupWorkerTest, type WorkerTestHarness } from '../../test-helpers';

describe('browser.full_sync', () => {
  let harness: WorkerTestHarness;

  beforeAll(async () => {
    harness = await setupWorkerTest({ now: '2026-09-04T15:00:00Z' });
  }, 60_000);

  afterAll(async () => {
    await harness.close();
    await closeTestDb();
  });

  it('baseline sync against the default mock state reconciles items, takes screenshots, and audits succeeded', async () => {
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });

    const result = (await dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' })) as BrowserJobResult;
    expect(result.login_ok).toBe(true);
    expect(result.snapshot_id).not.toBeNull();

    // The seed already has one baseline snapshot; this sync adds a second.
    const snapshotRows = await sdb.select(S.commonAppSnapshots);
    expect(snapshotRows).toHaveLength(2);
    expect(snapshotRows.some((s) => s.id === result.snapshot_id)).toBe(true);

    const school = (await deps.db.select().from(S.schools).where(eq(S.schools.slug, 'umich')).limit(1))[0];
    if (!school) throw new Error('umich school row missing');
    const application = await sdb.requireOne(S.applications, eq(S.applications.schoolId, school.id));
    const teacherRec1 = await sdb.requireOne(
      S.applicationItems,
      and(eq(S.applicationItems.applicationId, application.id), eq(S.applicationItems.ruleKey, 'teacher_rec:1')),
    );
    // Mr. Okafor (submitted 2026-09-01) sorts first — see docs/DEMO_STUDENT.md.
    expect(teacherRec1.status).toBe('done');

    const nextActionRows = await sdb.select(S.nextActions);
    expect(nextActionRows.length).toBeGreaterThan(0);

    const jobRow = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(jobRow.screenshots.length).toBeGreaterThan(0);
    for (const shot of jobRow.screenshots.slice(0, 3)) {
      const stored = await deps.storage.get(shot.storage_key);
      expect(stored).not.toBeNull();
    }

    const auditRows = await sdb.select(S.auditLog);
    expect(auditRows.some((a) => a.action === 'browser_job.full_sync.succeeded')).toBe(true);
  }, 180_000);

  it('a second sync against the unchanged mock state produces zero changes', async () => {
    const { deps, studentId } = harness;
    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });

    const result = (await dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' })) as BrowserJobResult;
    expect(result.changes_count).toBe(0);
    expect(harness.enqueuer.ofName('agent.sync_followup')).toHaveLength(0);
  }, 180_000);

  it('Ms. Park submitting for Michigan produces an important change, marks the item done, and enqueues sync_followup', async () => {
    const { deps, studentId, mock } = harness;
    const state = mock.getState();
    const umich = state.colleges.find((c) => c.slug === 'umich');
    const park = umich?.teachers.find((t) => t.name === 'Ms. Park');
    if (!umich || !park) throw new Error('fixture missing umich/Park');
    park.status = 'submitted';
    park.submittedAt = '2026-09-04';
    mock.setState(state);

    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });
    const result = (await dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' })) as BrowserJobResult;
    expect(result.changes_count).toBeGreaterThan(0);

    const school = (await deps.db.select().from(S.schools).where(eq(S.schools.slug, 'umich')).limit(1))[0];
    if (!school) throw new Error('umich school row missing');
    const application = await sdb.requireOne(S.applications, eq(S.applications.schoolId, school.id));
    const teacherRec2 = await sdb.requireOne(
      S.applicationItems,
      and(eq(S.applicationItems.applicationId, application.id), eq(S.applicationItems.ruleKey, 'teacher_rec:2')),
    );
    expect(teacherRec2.status).toBe('done');

    const followups = harness.enqueuer.ofName('agent.sync_followup');
    expect(followups.length).toBeGreaterThan(0);
    expect(followups[0]?.payload.studentId).toBe(studentId);
  }, 180_000);
});
