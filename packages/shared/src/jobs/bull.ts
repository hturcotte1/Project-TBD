import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { type EnqueueOptions, type EnqueuedJob, type JobEnqueuer, type JobName, type JobPayload, JobPayloads, QUEUES, queueOf, type QueueName, safeJobIdPart } from './definitions';

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
  removeOnFail: { count: 5000 },
};

/** BullMQ-backed enqueuer. One Queue per queue name, all on one Redis connection. */
export class BullJobEnqueuer implements JobEnqueuer {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly connection: Redis) {}

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
      this.queues.set(name, q);
    }
    return q;
  }

  async enqueue<N extends JobName>(name: N, payload: JobPayload<N>, opts: EnqueueOptions = {}): Promise<EnqueuedJob> {
    JobPayloads[name].parse(payload);
    const queue = queueOf(name);
    const job = await this.queue(queue).add(name, payload, {
      jobId: opts.jobId === undefined ? undefined : safeJobIdPart(opts.jobId),
      delay: opts.delayMs,
      priority: opts.priority,
      attempts: opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts,
    });
    return { id: String(job.id), name, queue };
  }

  async cancelByPrefix(queue: QueueName, prefix: string): Promise<number> {
    const q = this.queue(queue);
    const jobs = await q.getJobs(['waiting', 'delayed', 'prioritized', 'paused']);
    let n = 0;
    for (const job of jobs) {
      if (job.id && String(job.id).startsWith(prefix)) {
        await job.remove();
        n++;
      }
    }
    return n;
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}

export const ALL_QUEUES: QueueName[] = Object.values(QUEUES);
