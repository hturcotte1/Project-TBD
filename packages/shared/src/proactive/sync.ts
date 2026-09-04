import { localDate, localHour, localInstant, localTime } from '../time/dates';
import type { TriggerStudent } from './types';

/** Ordinary cadence between syncs when nothing else is pushing for a faster check. */
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Tighter cadence once a deadline is close enough that stale state is costly. */
const SYNC_INTERVAL_NEAR_DEADLINE_MS = 2 * 60 * 60 * 1000;
const SYNC_NEAR_DEADLINE_DAYS = 3;

/** The morning window we make sure at least one sync has happened in, ahead of the morning plan. */
const MORNING_WINDOW_START = '07:00';
const MORNING_WINDOW_END = '08:00';

export interface SyncDecision {
  due: boolean;
  /** Stable string for the idempotent sync job id; two calls in the same bucket agree on it. */
  bucket: string;
  reason: string;
}

/**
 * Whether a `browser:full_sync` should run right now. Pure function of the student's last sync
 * time and the clock — no I/O. `nearestDeadlineDays` (null if the student has no open
 * applications) tightens the cadence as a deadline approaches.
 */
export function shouldSync(student: TriggerStudent, now: Date, nearestDeadlineDays: number | null): SyncDecision {
  const tz = student.timezone;
  const today = localDate(now, tz);
  const time = localTime(now, tz);
  const hour = localHour(now, tz);
  const nearDeadline = nearestDeadlineDays !== null && nearestDeadlineDays <= SYNC_NEAR_DEADLINE_DAYS;
  // The bucket feeds the idempotent job id, so it must be as fine as the cadence it enforces:
  // 6-hour slots normally, 2-hour slots when a deadline is close.
  const slotHours = nearDeadline ? SYNC_INTERVAL_NEAR_DEADLINE_MS / (60 * 60 * 1000) : SYNC_INTERVAL_MS / (60 * 60 * 1000);
  const slot = Math.floor(hour / slotHours);
  const regularBucket = `${today}T${nearDeadline ? 'n' : ''}${slot}`;

  if (student.syncPausedReason !== null) {
    return { due: false, bucket: regularBucket, reason: `sync paused: ${student.syncPausedReason}` };
  }

  const inMorningWindow = time >= MORNING_WINDOW_START && time < MORNING_WINDOW_END;
  if (inMorningWindow) {
    const morningWindowStart = localInstant(today, MORNING_WINDOW_START, tz);
    const syncedSinceMorningStart = student.lastSyncAt !== null && student.lastSyncAt >= morningWindowStart;
    if (!syncedSinceMorningStart) {
      return { due: true, bucket: `${today}-morning`, reason: "morning sync window and no sync yet since 07:00 local" };
    }
  }

  if (student.lastSyncAt === null) {
    return { due: true, bucket: regularBucket, reason: 'never synced' };
  }

  const interval = nearDeadline ? SYNC_INTERVAL_NEAR_DEADLINE_MS : SYNC_INTERVAL_MS;
  const msSinceSync = now.getTime() - student.lastSyncAt.getTime();
  if (msSinceSync >= interval) {
    const hoursSinceSync = Math.floor(msSinceSync / (60 * 60 * 1000));
    return { due: true, bucket: regularBucket, reason: `last sync was ${hoursSinceSync}h ago` };
  }

  return { due: false, bucket: regularBucket, reason: 'synced recently enough' };
}
