import { describe, expect, it } from 'vitest';
import { browserJobsRepo, scoped, studentsRepo } from '@tbd/shared/db';
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
});
