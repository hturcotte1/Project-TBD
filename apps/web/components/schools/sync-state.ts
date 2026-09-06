import type { ApplicationStatus, BrowserJobStatus } from '@apogee/shared/domain';

const ACTIVE_JOB_STATUSES = new Set<BrowserJobStatus>(['queued', 'running']);

/** Whether the account's one shared browser session is actively working right now — sync is
 * per-student, not per-school, so this applies the same to every row in the table. */
export function isSyncActive(lastJobStatus: BrowserJobStatus | null | undefined): boolean {
  return lastJobStatus != null && ACTIVE_JOB_STATUSES.has(lastJobStatus);
}

/** Whether the student's sync pause reason is Common App waiting on a verification code. */
export function needsVerificationCode(syncPausedReason: string | null | undefined): boolean {
  return !!syncPausedReason && /verification code/i.test(syncPausedReason);
}

export interface RowStatusWord {
  text: string;
  tone: 'ok' | 'muted';
}

/**
 * The Schools table's Status cell for one active-table row: submitted beats a code request beats
 * a running sync beats silence, since a school that's already in (submitted) has nothing left for
 * sync state to say about it.
 */
export function applicationStatusWord(params: {
  status: ApplicationStatus;
  syncActive: boolean;
  needsCode: boolean;
}): RowStatusWord | null {
  if (params.status === 'submitted') return { text: 'Submitted', tone: 'ok' };
  if (params.needsCode) return { text: 'Needs a code', tone: 'muted' };
  if (params.syncActive) return { text: 'Syncing', tone: 'muted' };
  return null;
}
