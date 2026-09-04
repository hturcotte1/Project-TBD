import { z } from 'zod';
import { NUDGE_KINDS } from '../domain/enums';
import { IsoDate } from './common';

/** A deterministic trigger produced by evaluateTriggers(); the key makes it idempotent. */
export const TriggerEvent = z.object({
  kind: z.enum(NUDGE_KINDS),
  /** Stable, e.g. "deadline_countdown:<applicationId>:7". Never fires twice. */
  trigger_key: z.string().max(200),
  application_id: z.string().uuid().nullable().default(null),
  application_item_id: z.string().uuid().nullable().default(null),
  recommender_id: z.string().uuid().nullable().default(null),
  essay_id: z.string().uuid().nullable().default(null),
  due_date: IsoDate.nullable().default(null),
  days_remaining: z.number().int().nullable().default(null),
  /** Facts the LLM must reference; it may not invent others. */
  facts: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  /** Day-of-deadline alerts bypass quiet hours and caps. */
  always_send: z.boolean().default(false),
  priority: z.number().min(0).max(100),
});
export type TriggerEvent = z.infer<typeof TriggerEvent>;
