import { describe, expect, it } from 'vitest';
import { browserJobsRepo, scoped, studentsRepo } from '@apogee/shared/db';
import type { MemoryJobEnqueuer } from '@apogee/shared/jobs';
import { dispatch } from '../../dispatch';
import { closeTestDb, setupWorkerTest } from '../../test-helpers';

describe('browser.full_sync repeated failures', () => {
  it('pauses syncing after 3 consecutive failures and texts once; a 4th failure sends nothing new', async () => {
    // No mock server is started — every login attempt hits a closed port and fails.
    const harness = await setupWorkerTest({ startMock: false });
    try {
      const { deps, studentId } = harness;
      const sdb = scoped(deps.db, studentId);

      for (let i = 0; i < 3; i++) {
        const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });
        await expect(dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' })).rejects.toThrow();
      }

      const student = await studentsRepo.findById(deps.db, studentId);
      expect(student?.syncPausedReason).toBe('browser_failures');

      const pausedTexts = harness.messaging.sent.filter((m) => m.body.includes("couldn't get into your Common App"));
      expect(pausedTexts).toHaveLength(1);

      const job4 = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });
      await expect(dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job4.id, reason: 'manual' })).rejects.toThrow();

      const pausedTextsAfter = harness.messaging.sent.filter((m) => m.body.includes("couldn't get into your Common App"));
      expect(pausedTextsAfter).toHaveLength(1);
    } finally {
      await harness.close();
      await closeTestDb();
    }
  }, 60_000);

  it('holds the reconnect text during quiet hours and delivers it through a delayed proactive run', async () => {
    // 08:00Z = 03:00 in America/Chicago, inside the demo student's 22:00-07:00 quiet hours.
    const harness = await setupWorkerTest({ startMock: false, now: '2026-09-05T08:00:00Z' });
    try {
      const { deps, studentId } = harness;
      const sdb = scoped(deps.db, studentId);
      for (let i = 0; i < 3; i++) {
        const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });
        await expect(dispatch(deps, 'browser.full_sync', { studentId, browserJobId: job.id, reason: 'manual' })).rejects.toThrow();
      }
      expect((await studentsRepo.findById(deps.db, studentId))?.syncPausedReason).toBe('browser_failures');
      expect(harness.messaging.sent.filter((m) => m.body.includes("couldn't get into your Common App"))).toHaveLength(0);
      const deferred = (deps.enqueuer as MemoryJobEnqueuer).ofName('agent.proactive_run');
      expect(deferred).toHaveLength(1);
      expect(deferred[0]!.payload.triggers[0]!.kind).toBe('custom');
      expect(String(deferred[0]!.payload.triggers[0]!.facts.message)).toContain("couldn't get into your Common App");
      // 03:00 -> 07:00 local is four hours.
      expect(deferred[0]!.opts.delayMs).toBe(4 * 60 * 60 * 1000);
    } finally {
      await harness.close();
      await closeTestDb();
    }
  }, 60_000);
});
