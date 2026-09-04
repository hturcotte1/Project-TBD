import { sendCap } from '../prioritize';
import type { NudgeIntensity } from '../domain/enums';
import type { TriggerEvent } from '../schemas/proactive';
import type { QuietHours } from '../schemas/profile';
import { isQuietNow, nextQuietHoursEnd } from '../time/dates';

export interface NudgePlanInput {
  now: Date;
  timezone: string;
  quietHours: QuietHours;
  intensity: NudgeIntensity;
  /** Set when the student asked to be left alone ("leave me alone tonight"). */
  snoozedUntil: Date | null;
  candidates: TriggerEvent[];
  /** How many proactive messages already went out today, for the daily cap. */
  sentTodayCount: number;
  /** application_item_id values the student has acknowledged or snoozed; their triggers are dropped. */
  suppressedItemIds: Set<string>;
}

export type DropReason = 'cap' | 'suppressed' | 'duplicate';

export interface NudgePlan {
  /** Each inner array is one outbound message: related triggers batched together. */
  batches: TriggerEvent[][];
  /** When quiet hours or a snooze deferred everything non-`always_send`, the instant to retry. */
  deferUntil: Date | null;
  dropped: Array<{ trigger: TriggerEvent; reason: DropReason }>;
}

function maxPriority(batch: TriggerEvent[]): number {
  return Math.max(...batch.map((t) => t.priority));
}

function isAlwaysSendBatch(batch: TriggerEvent[]): boolean {
  return batch.some((t) => t.always_send);
}

/**
 * Turns raw trigger candidates into outbound message batches, respecting quiet hours, snoozes,
 * per-item suppression, and the daily send cap. Pure function: no clock reads, no DB, no
 * randomness — every decision is a function of the given inputs.
 */
export function planNudges(input: NudgePlanInput): NudgePlan {
  const dropped: NudgePlan['dropped'] = [];

  // 1. Dedupe identical trigger_keys (evaluateTriggers should never emit these, but callers may
  //    merge candidates from more than one tick before a plan runs).
  const seenKeys = new Set<string>();
  const deduped: TriggerEvent[] = [];
  for (const t of input.candidates) {
    if (seenKeys.has(t.trigger_key)) {
      dropped.push({ trigger: t, reason: 'duplicate' });
      continue;
    }
    seenKeys.add(t.trigger_key);
    deduped.push(t);
  }

  // 2. Drop triggers on items the student already acknowledged or snoozed.
  const notSuppressed: TriggerEvent[] = [];
  for (const t of deduped) {
    if (t.application_item_id !== null && input.suppressedItemIds.has(t.application_item_id)) {
      dropped.push({ trigger: t, reason: 'suppressed' });
      continue;
    }
    notSuppressed.push(t);
  }

  // 3. Quiet hours / snooze: hold everything but always_send triggers for later. Deferred triggers
  //    are neither sent nor dropped — their trigger_key is never recorded, so the next planning
  //    pass (after deferUntil) sees them again as fresh candidates.
  const isQuiet = isQuietNow(input.now, input.timezone, input.quietHours);
  const isSnoozed = input.snoozedUntil !== null && input.now < input.snoozedUntil;
  const deferInstants: Date[] = [];
  if (isQuiet) deferInstants.push(nextQuietHoursEnd(input.now, input.timezone, input.quietHours));
  if (isSnoozed && input.snoozedUntil !== null) deferInstants.push(input.snoozedUntil);
  const deferUntil = deferInstants.length > 0 ? new Date(Math.max(...deferInstants.map((d) => d.getTime()))) : null;

  const sendable = deferUntil === null ? notSuppressed : notSuppressed.filter((t) => t.always_send);

  // 4. Batch related triggers into one message each: same application_id share a batch; anything
  //    with no application (morning plan, weekly plan) stands alone.
  const byApplication = new Map<string, TriggerEvent[]>();
  const standalone: TriggerEvent[][] = [];
  for (const t of sendable) {
    if (t.application_id !== null) {
      const existing = byApplication.get(t.application_id);
      if (existing) existing.push(t);
      else byApplication.set(t.application_id, [t]);
    } else {
      standalone.push([t]);
    }
  }
  const allBatches = [...byApplication.values(), ...standalone];

  // 5. Enforce the daily cap on batches (one send = one batch). always_send batches are exempt
  //    and are never dropped by the cap.
  const alwaysSendBatches = allBatches.filter(isAlwaysSendBatch);
  const otherBatches = allBatches.filter((b) => !isAlwaysSendBatch(b)).sort((a, b) => maxPriority(b) - maxPriority(a));

  const remainingCap = Math.max(0, sendCap(input.intensity) - input.sentTodayCount);
  const admitted = otherBatches.slice(0, remainingCap);
  const overCap = otherBatches.slice(remainingCap);
  for (const batch of overCap) {
    for (const t of batch) dropped.push({ trigger: t, reason: 'cap' });
  }

  // 6. Order every outgoing batch by its highest-priority trigger, descending.
  const batches = [...alwaysSendBatches, ...admitted].sort((a, b) => maxPriority(b) - maxPriority(a));

  return { batches, deferUntil, dropped };
}
