/**
 * Worker process entry point: wires every real adapter (`createWorkerDeps`), starts one BullMQ
 * `Worker` per queue routed through `dispatch()`, upserts the repeatable `scheduler.tick`, and
 * shuts down cleanly on SIGTERM.
 */
import { Worker, type Job } from 'bullmq';
import { loadEnv } from '@apogee/shared/config';
import { QUEUES, type JobName } from '@apogee/shared/jobs';
import { createLogger } from '@apogee/shared/logging';
import { createWorkerDeps } from './deps';
import { dispatch } from './dispatch';

const TICK_INTERVAL_MS = 5 * 60 * 1000;
const BROWSER_LOCK_DURATION_MS = 15 * 60 * 1000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ name: 'worker', pretty: env.NODE_ENV === 'development' });

  const created = await createWorkerDeps(env, logger);
  const { deps } = created;

  const processor = async (job: Job): Promise<unknown> => {
    const log = logger.child({ jobId: job.id, jobName: job.name, studentId: (job.data as { studentId?: string })?.studentId });
    log.info('job.started');
    try {
      const result = await dispatch(deps, job.name as JobName, job.data);
      log.info('job.completed');
      return result;
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'job.failed');
      throw err;
    }
  };

  const workers: Worker[] = [
    new Worker(QUEUES.browser, processor, { connection: created.redis.makeBlockingConnection(), concurrency: 2, lockDuration: BROWSER_LOCK_DURATION_MS }),
    new Worker(QUEUES.agent, processor, { connection: created.redis.makeBlockingConnection(), concurrency: 4 }),
    new Worker(QUEUES.scheduler, processor, { connection: created.redis.makeBlockingConnection(), concurrency: 1 }),
    new Worker(QUEUES.maintenance, processor, { connection: created.redis.makeBlockingConnection(), concurrency: 2 }),
  ];
  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'worker.job_failed');
    });
  }

  await created.enqueuer.queue(QUEUES.scheduler).add('scheduler.tick', {}, { jobId: 'scheduler-tick', repeat: { every: TICK_INTERVAL_MS } });

  logger.info({ mockCommonApp: env.MOCK_COMMONAPP, commonAppBaseUrl: env.COMMONAPP_BASE_URL }, 'worker.started');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'worker.shutting_down');
    await Promise.all(workers.map((w) => w.close()));
    await created.close();
    logger.info('worker.shutdown_complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('worker failed to start', err);
  process.exit(1);
});
