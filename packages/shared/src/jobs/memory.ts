import { randomUUID } from 'node:crypto';
import { type EnqueueOptions, type EnqueuedJob, type JobEnqueuer, type JobName, type JobPayload, JobPayloads, queueOf, type QueueName } from './definitions';

export interface RecordedJob {
  id: string;
  name: JobName;
  queue: QueueName;
  payload: unknown;
  opts: EnqueueOptions;
}

/** In-memory enqueuer for tests and the fake phone: records jobs; a test can drain and run them. */
export class MemoryJobEnqueuer implements JobEnqueuer {
  readonly jobs: RecordedJob[] = [];

  async enqueue<N extends JobName>(name: N, payload: JobPayload<N>, opts: EnqueueOptions = {}): Promise<EnqueuedJob> {
    JobPayloads[name].parse(payload);
    if (opts.jobId?.includes(':')) throw new Error(`job id "${opts.jobId}" contains ":" which BullMQ rejects; use jobIds helpers`);
    const id = opts.jobId ?? randomUUID();
    if (opts.jobId && this.jobs.some((j) => j.id === id && j.queue === queueOf(name))) {
      return { id, name, queue: queueOf(name) };
    }
    const job: RecordedJob = { id, name, queue: queueOf(name), payload, opts };
    this.jobs.push(job);
    return { id, name, queue: job.queue };
  }

  async cancelByPrefix(queue: QueueName, prefix: string): Promise<number> {
    const before = this.jobs.length;
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const j = this.jobs[i];
      if (j && j.queue === queue && j.id.startsWith(prefix)) this.jobs.splice(i, 1);
    }
    return before - this.jobs.length;
  }

  drain(): RecordedJob[] {
    return this.jobs.splice(0, this.jobs.length);
  }

  ofName<N extends JobName>(name: N): Array<RecordedJob & { payload: JobPayload<N> }> {
    return this.jobs.filter((j): j is RecordedJob & { payload: JobPayload<N> } => j.name === name);
  }
}
