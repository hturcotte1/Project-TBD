import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createCommonAppClient, LocalChromiumSessionProvider } from '@apogee/browser';
import { RuleBasedFakeLLM } from '@apogee/agent';
import { FakeMessagingProvider } from '@apogee/messaging';
import { loadEnv } from '@apogee/shared/config';
import { parseKeyRing } from '@apogee/shared/crypto';
import { credentialsRepo, scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import type { Db } from '@apogee/shared/db';
import { LocalDiskStorageProvider, MemoryVerificationCodeChannel } from '@apogee/shared/adapters';
import { MemoryJobEnqueuer } from '@apogee/shared/jobs';
import { createLogger } from '@apogee/shared/logging';
import { evaluateTriggers } from '@apogee/shared/proactive';
import { loadTriggerState } from '@apogee/shared/services';
import { closeTestDb, createTestSchool, createTestStudent, getTestDb, truncateAll } from '@apogee/shared/testing';
import { FixedClock } from '@apogee/shared/time';
import { dispatch } from '../dispatch';
import { acquireDbLock, withTruncateRetry } from '../test-helpers';
import { runTick } from './tick';
import type { WorkerDeps } from '../deps';

async function buildDeps(now: string): Promise<{ deps: WorkerDeps; enqueuer: MemoryJobEnqueuer; messaging: FakeMessagingProvider; db: Db }> {
  const db = await getTestDb();
  const env = loadEnv();
  const logger = createLogger({ name: 'scheduler-test', level: 'silent' });
  const clock = new FixedClock(now);
  const enqueuer = new MemoryJobEnqueuer();
  const messaging = new FakeMessagingProvider({ logger });
  const tmpDir = await mkdtemp(join(tmpdir(), 'apogee-sched-test-'));
  const storage = new LocalDiskStorageProvider(tmpDir, 'http://localhost:4000');
  const keyRing = parseKeyRing(env.CREDENTIALS_ENCRYPTION_KEYS, env.CREDENTIALS_ENCRYPTION_KEY_VERSION);
  // Never actually opened in these tests: runTick only enqueues browser jobs, it never runs them.
  const sessions = new LocalChromiumSessionProvider({ executablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const browser = createCommonAppClient({ baseUrl: 'http://127.0.0.1:1', logger, fallback: null, recordFixtures: null });
  const deps: WorkerDeps = {
    db,
    llm: new RuleBasedFakeLLM(),
    messaging,
    enqueuer,
    storage,
    codeChannel: new MemoryVerificationCodeChannel(),
    clock,
    logger,
    env,
    browser,
    sessions,
    keyRing,
    verificationTimeoutMs: 10 * 60 * 1000,
  };
  return { deps, enqueuer, messaging, db };
}

interface MichiganFixture {
  studentId: string;
  applicationId: string;
}

/** A minimal onboarded student with exactly one open application (Michigan, EA, due 2026-11-01) —
 * gives every trigger-count assertion a clean, unambiguous denominator. */
async function seedMichiganOnlyStudent(db: Db): Promise<MichiganFixture> {
  const student = await createTestStudent(db, {
    timezone: 'America/Chicago',
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    nudgeIntensity: 'normal',
    status: 'active',
    onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
  });
  const school = await createTestSchool(db, { slug: `umich-sched-${student.id.slice(0, 8)}`, name: 'University of Michigan' });
  const sdb = scoped(db, student.id);
  const [application] = await sdb.insert(S.applications, {
    schoolId: school.id,
    plan: 'EA',
    deadline: '2026-11-01',
    status: 'in_progress',
    commonAppCollegeId: school.slug,
  });
  if (!application) throw new Error('application insert failed');
  return { studentId: student.id, applicationId: application.id };
}

describe('scheduler.tick', () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it('deadline countdown: enqueues one proactive_run 3 days before the Michigan deadline; a second tick enqueues nothing new', async () => {
    const release = await acquireDbLock();
    try {
      const db = await getTestDb();
      const fixture = await withTruncateRetry(async () => {
        await truncateAll(db);
        return seedMichiganOnlyStudent(db);
      });
      const { deps, enqueuer } = await buildDeps('2026-10-29T15:00:00Z'); // 10:00 America/Chicago — 3 days out

      const summary = await runTick(deps);
      expect(summary.proactiveEnqueued).toBe(1);

      const jobs = enqueuer.ofName('agent.proactive_run');
      expect(jobs).toHaveLength(1);
      const triggers = jobs[0]?.payload.triggers ?? [];
      const deadlineTriggers = triggers.filter((t) => t.kind === 'deadline_countdown');
      expect(deadlineTriggers).toHaveLength(1);
      expect(deadlineTriggers[0]?.trigger_key).toBe(`deadline_countdown:${fixture.applicationId}:3`);

      await runTick(deps);
      expect(enqueuer.ofName('agent.proactive_run')).toHaveLength(1);
    } finally {
      release();
    }
  }, 30_000);

  it('defers a proactive run during quiet hours (no text) and sends once quiet hours end', async () => {
    const release = await acquireDbLock();
    try {
      const db = await getTestDb();
      const fixture = await withTruncateRetry(async () => {
        await truncateAll(db);
        return seedMichiganOnlyStudent(db);
      });

      // Generate the trigger as evaluateTriggers would at 10:00 local on 2026-10-29 (hour >= 9 gate).
      const genDeps = await buildDeps('2026-10-29T15:00:00Z');
      const genSdb = scoped(genDeps.deps.db, fixture.studentId);
      const studentRow = await studentsRepo.findById(genDeps.deps.db, fixture.studentId);
      if (!studentRow) throw new Error('student missing');
      const state = await loadTriggerState(genSdb, studentRow, genDeps.deps.clock.now());
      const triggers = evaluateTriggers(state, genDeps.deps.clock.now());
      expect(triggers).toHaveLength(1);

      // Process the job at 03:00 local the next day — quiet hours (22:00-07:00).
      const quiet = await buildDeps('2026-10-30T08:00:00Z');
      await dispatch(quiet.deps, 'agent.proactive_run', { studentId: fixture.studentId, triggers, tickAt: '2026-10-29T15:00:00Z' });
      expect(quiet.messaging.sent).toHaveLength(0);
      const deferredJobs = quiet.enqueuer.ofName('agent.proactive_run');
      expect(deferredJobs).toHaveLength(1);
      const deferredJob = deferredJobs[0];
      if (!deferredJob) throw new Error('deferred job missing');
      expect(deferredJob.opts.delayMs).toBeGreaterThan(0);
      // Quiet hours end at 07:00 America/Chicago (CDT, UTC-5 in late October) = 12:00 UTC.
      const actualDeferUntilMs = new Date('2026-10-30T08:00:00Z').getTime() + (deferredJob.opts.delayMs ?? 0);
      expect(Math.abs(actualDeferUntilMs - new Date('2026-10-30T12:00:00Z').getTime())).toBeLessThan(1000);

      // Process the (re-enqueued) job at 10:00 local — outside quiet hours — exactly one text.
      const day = await buildDeps('2026-10-30T15:00:00Z');
      await dispatch(day.deps, 'agent.proactive_run', deferredJob.payload);
      expect(day.messaging.sent).toHaveLength(1);
      const text = day.messaging.sent[0]?.body ?? '';
      expect(text).toContain('Michigan');
      expect(text).toContain('3');
    } finally {
      release();
    }
  }, 30_000);

  it('recommender inactivity: one text; the next day, none (already recorded)', async () => {
    const release = await acquireDbLock();
    try {
      const db = await getTestDb();
      await withTruncateRetry(async () => {
        await truncateAll(db);
        const f = await seedMichiganOnlyStudent(db);
        const sdb = scoped(db, f.studentId);
        const [park] = await sdb.insert(S.recommenders, { name: 'Ms. Park', role: 'teacher', email: 'park@example.com', inviteStatus: 'invited', invitedAt: '2026-09-02' });
        if (!park) throw new Error('recommender insert failed');
        await sdb.insert(S.recommenderAssignments, { recommenderId: park.id, applicationId: f.applicationId, status: 'invited', invitedAt: '2026-09-02' });
        return f;
      });

      const day1 = await buildDeps('2026-10-12T15:00:00Z');
      const tick1 = await runTick(day1.deps);
      expect(tick1.proactiveEnqueued).toBe(1);
      const job1 = day1.enqueuer.ofName('agent.proactive_run')[0];
      if (!job1) throw new Error('job missing');
      await dispatch(day1.deps, 'agent.proactive_run', job1.payload);
      const texts1 = day1.messaging.sent.filter((m) => m.body.toLowerCase().includes('park'));
      expect(texts1).toHaveLength(1);

      const day2 = await buildDeps('2026-10-13T15:00:00Z');
      const tick2 = await runTick(day2.deps);
      expect(tick2.proactiveEnqueued).toBe(0);
      expect(day2.enqueuer.ofName('agent.proactive_run')).toHaveLength(0);
    } finally {
      release();
    }
  }, 30_000);

  it('enqueues a sync when one is due, with a stable bucket id; a second tick does not duplicate it', async () => {
    const release = await acquireDbLock();
    try {
      const db = await getTestDb();
      await withTruncateRetry(async () => {
        await truncateAll(db);
        const f = await seedMichiganOnlyStudent(db);
        const sdb = scoped(db, f.studentId);
        const env = loadEnv();
        const keyRing = parseKeyRing(env.CREDENTIALS_ENCRYPTION_KEYS, env.CREDENTIALS_ENCRYPTION_KEY_VERSION);
        await credentialsRepo.store(sdb, keyRing, 'common_app', 'demo@example.com', 'demo-password');
        await credentialsRepo.markVerified(sdb, 'common_app');
        return f;
      });

      const { deps, enqueuer } = await buildDeps('2026-10-12T15:00:00Z');
      const summary = await runTick(deps);
      expect(summary.syncsEnqueued).toBe(1);
      const syncJobs = enqueuer.ofName('browser.full_sync');
      expect(syncJobs).toHaveLength(1);
      const firstJobId = syncJobs[0]?.id;

      await runTick(deps);
      const syncJobsAfter = enqueuer.ofName('browser.full_sync');
      expect(syncJobsAfter).toHaveLength(1);
      expect(syncJobsAfter[0]?.id).toBe(firstJobId);
    } finally {
      release();
    }
  }, 30_000);

  it('expires stale approvals on every tick', async () => {
    const release = await acquireDbLock();
    try {
      const db = await getTestDb();
      const { fixture, approval } = await withTruncateRetry(async () => {
        await truncateAll(db);
        const f = await seedMichiganOnlyStudent(db);
        const sdb = scoped(db, f.studentId);
        const [a] = await sdb.insert(S.approvals, {
          kind: 'fill_fields',
          summary: 'stale',
          payload: { kind: 'fill_fields', section: 'activities', school_slug: null, fields: [{ path: 'activities[0].position', label: 'x', value: 'x' }], origin: 'student_profile' },
          status: 'pending',
          requestedVia: 'imessage',
          // approvalsRepo.expireStale compares against the real wall clock, not the FixedClock — this
          // must be in the past relative to whenever this test actually runs.
          expiresAt: new Date('2020-01-01T00:00:00Z'),
        });
        if (!a) throw new Error('approval insert failed');
        return { fixture: f, approval: a };
      });
      const sdb = scoped(db, fixture.studentId);

      const { deps } = await buildDeps('2026-10-12T15:00:00Z');
      await runTick(deps);

      const row = await sdb.requireOne(S.approvals, eq(S.approvals.id, approval.id));
      expect(row.status).toBe('expired');
    } finally {
      release();
    }
  }, 30_000);
});
