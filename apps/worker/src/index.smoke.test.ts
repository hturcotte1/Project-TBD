/** One end-to-end smoke test against a real local Redis: a BullMQ Queue/Worker pair (on a unique
 * key prefix so it never collides with a real worker or another test run) processes a
 * `maintenance.recompute_next_actions` job through `dispatch()` and the DB reflects the result. */
import { randomUUID } from 'node:crypto';
import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import type { JobName } from '@tbd/shared/jobs';
import { dispatch } from './dispatch';
import { closeTestDb, setupWorkerTest } from './test-helpers';

describe('BullMQ smoke test', () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it('a real BullMQ queue+worker processes maintenance.recompute_next_actions', async () => {
    const harness = await setupWorkerTest();
    const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const prefix = `tbd-worker-smoke-${randomUUID().slice(0, 8)}`;
    const queue = new Queue('maintenance', { connection, prefix });
    const worker = new Worker(
      'maintenance',
      async (job: Job) => dispatch(harness.deps, job.name as JobName, job.data),
      { connection, prefix },
    );

    try {
      await queue.add('maintenance.recompute_next_actions', { studentId: harness.studentId, reason: 'smoke_test' });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for the job to complete')), 20_000);
        worker.on('completed', () => {
          clearTimeout(timer);
          resolve();
        });
        worker.on('failed', (_job, err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } finally {
      await worker.close();
      await queue.close();
      connection.disconnect();
    }

    const sdb = scoped(harness.deps.db, harness.studentId);
    const rows = await sdb.select(S.nextActions);
    expect(rows.length).toBeGreaterThan(0);

    await harness.close();
  }, 40_000);
});
