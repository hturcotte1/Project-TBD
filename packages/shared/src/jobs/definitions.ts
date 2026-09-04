import { z } from 'zod';
import { CONVERSATION_KINDS } from '../domain/enums';
import { TriggerEvent } from '../schemas/proactive';
import { IsoDate } from '../schemas/common';

export const QUEUES = {
  browser: 'browser',
  agent: 'agent',
  scheduler: 'scheduler',
  maintenance: 'maintenance',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const uuid = z.string().uuid();

/**
 * Every job the worker can run, keyed "<queue>.<name>", with its zod payload.
 * The API and agent tools enqueue through JobEnqueuer; the worker validates on receipt.
 */
export const JobPayloads = {
  'browser.verify_credentials': z.object({ studentId: uuid, browserJobId: uuid }),
  'browser.full_sync': z.object({
    studentId: uuid,
    browserJobId: uuid,
    reason: z.enum(['scheduled', 'manual', 'onboarding', 'verification', 'agent_request', 'admin']),
  }),
  'browser.fill_fields': z.object({ studentId: uuid, browserJobId: uuid, approvalId: uuid }),
  'browser.check_recommenders': z.object({ studentId: uuid, browserJobId: uuid }),

  'agent.inbound_message': z.object({
    studentId: uuid,
    messageId: uuid,
    conversationKind: z.enum(CONVERSATION_KINDS),
  }),
  'agent.proactive_run': z.object({ studentId: uuid, triggers: z.array(TriggerEvent).min(1), tickAt: z.string() }),
  'agent.sync_followup': z.object({ studentId: uuid, snapshotId: uuid, browserJobId: uuid }),
  'agent.essay_feedback': z.object({ studentId: uuid, essayId: uuid, draftId: uuid, runId: uuid }),
  'agent.document_extraction': z.object({ studentId: uuid, documentId: uuid }),
  'agent.weekly_plan': z.object({ studentId: uuid, weekStart: IsoDate }),
  'agent.reminder_draft': z.object({ studentId: uuid, recommenderId: uuid, runId: uuid }),
  'agent.welcome': z.object({ studentId: uuid }),
  'agent.narrative_summary': z.object({ studentId: uuid, runId: uuid }),

  'scheduler.tick': z.object({}),

  'maintenance.recompute_next_actions': z.object({ studentId: uuid, reason: z.string().max(100) }),
  'maintenance.disconnect_commonapp': z.object({ studentId: uuid }),
  'maintenance.delete_account': z.object({ studentId: uuid }),
  'maintenance.export_data': z.object({ studentId: uuid, runId: uuid }),
  'maintenance.first_plan': z.object({ studentId: uuid }),
} as const;

export type JobName = keyof typeof JobPayloads;
export type JobPayload<N extends JobName> = z.infer<(typeof JobPayloads)[N]>;

export function queueOf(name: JobName): QueueName {
  return name.split('.')[0] as QueueName;
}

export interface EnqueueOptions {
  /** Deterministic id for idempotency (BullMQ drops duplicates while the job exists). */
  jobId?: string;
  delayMs?: number;
  priority?: number;
  attempts?: number;
}

export interface EnqueuedJob {
  id: string;
  name: JobName;
  queue: QueueName;
}

export interface JobEnqueuer {
  enqueue<N extends JobName>(name: N, payload: JobPayload<N>, opts?: EnqueueOptions): Promise<EnqueuedJob>;
  /** Cancel queued/delayed jobs whose id starts with the prefix (e.g. `browser:<studentId>:`). */
  cancelByPrefix(queue: QueueName, prefix: string): Promise<number>;
}

/** Stable job ids so re-ticks and retries never double-enqueue. */
export const jobIds = {
  sync: (studentId: string, bucket: string) => `sync:${studentId}:${bucket}`,
  verify: (browserJobId: string) => `verify:${browserJobId}`,
  fill: (approvalId: string) => `fill:${approvalId}`,
  proactive: (studentId: string, bucket: string) => `proactive:${studentId}:${bucket}`,
  inbound: (messageId: string) => `inbound:${messageId}`,
  weekly: (studentId: string, weekStart: string) => `weekly:${studentId}:${weekStart}`,
  extraction: (documentId: string) => `extract:${documentId}`,
  essayFeedback: (runId: string) => `essay:${runId}`,
  tick: () => 'scheduler-tick',
  browserPrefix: (studentId: string) => `sync:${studentId}:`,
};
