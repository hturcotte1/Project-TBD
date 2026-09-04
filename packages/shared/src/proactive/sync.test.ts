import { describe, expect, it } from 'vitest';
import { shouldSync } from './sync';
import type { TriggerStudent } from './types';

const NY = 'America/New_York';

function student(overrides: Partial<TriggerStudent> = {}): TriggerStudent {
  return {
    id: 'student-1',
    timezone: NY,
    quietHours: { start: '22:00', end: '07:00' },
    nudgeIntensity: 'normal',
    snoozedUntil: null,
    onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    syncPausedReason: null,
    lastSyncAt: new Date('2026-09-04T04:00:00Z'), // midnight NY
    ...overrides,
  };
}

describe('shouldSync', () => {
  it('is due when the student has never synced', () => {
    const now = new Date('2026-09-04T14:00:00Z'); // 10am NY
    const result = shouldSync(student({ lastSyncAt: null }), now, null);
    expect(result.due).toBe(true);
    expect(result.reason).toMatch(/never synced/);
  });

  it('is not due right after a sync', () => {
    const now = new Date('2026-09-04T15:00:00Z'); // 11am NY, 1h after lastSyncAt below
    const result = shouldSync(student({ lastSyncAt: new Date('2026-09-04T14:00:00Z') }), now, null);
    expect(result.due).toBe(false);
  });

  it('is due once 6 hours have passed since the last sync', () => {
    const lastSyncAt = new Date('2026-09-04T14:00:00Z');
    const stillFresh = shouldSync(student({ lastSyncAt }), new Date('2026-09-04T19:59:00Z'), null);
    expect(stillFresh.due).toBe(false);

    const dueNow = shouldSync(student({ lastSyncAt }), new Date('2026-09-04T20:00:00Z'), null);
    expect(dueNow.due).toBe(true);
    expect(dueNow.reason).toMatch(/6h ago/);
  });

  it('tightens to a 2-hour cadence when a deadline is within 3 days', () => {
    const lastSyncAt = new Date('2026-09-04T14:00:00Z');
    const now = new Date('2026-09-04T16:30:00Z'); // 2.5h later
    const farFromDeadline = shouldSync(student({ lastSyncAt }), now, 10);
    expect(farFromDeadline.due).toBe(false);

    const nearDeadline = shouldSync(student({ lastSyncAt }), now, 2);
    expect(nearDeadline.due).toBe(true);
  });

  it('is due during the 07:00-08:00 local window if nothing has synced since 07:00 today', () => {
    const now = new Date('2026-09-04T11:30:00Z'); // 7:30am NY
    const result = shouldSync(student({ lastSyncAt: new Date('2026-09-03T14:00:00Z') }), now, null);
    expect(result.due).toBe(true);
    expect(result.bucket).toBe('2026-09-04-morning');
  });

  it('is not re-triggered by the morning window once synced since 07:00', () => {
    const now = new Date('2026-09-04T11:30:00Z'); // 7:30am NY
    const result = shouldSync(student({ lastSyncAt: new Date('2026-09-04T11:15:00Z') }), now, null); // synced 7:15am
    expect(result.due).toBe(false);
  });

  it('produces stable, distinct buckets for the regular cadence vs. the morning window', () => {
    const morning = shouldSync(student({ lastSyncAt: null }), new Date('2026-09-04T11:30:00Z'), null); // 7:30am NY
    const midday = shouldSync(student({ lastSyncAt: null }), new Date('2026-09-04T17:00:00Z'), null); // 1pm NY
    expect(morning.bucket).not.toBe(midday.bucket);

    const sameSlotAgain = shouldSync(student({ lastSyncAt: null }), new Date('2026-09-04T17:30:00Z'), null); // still 1pm-ish NY
    expect(midday.bucket).toBe(sameSlotAgain.bucket);
  });

  it('is never due while sync is paused, regardless of staleness', () => {
    const longAgo = new Date('2026-01-01T00:00:00Z');
    const result = shouldSync(student({ lastSyncAt: longAgo, syncPausedReason: 'credentials invalid' }), new Date('2026-09-04T14:00:00Z'), 1);
    expect(result.due).toBe(false);
    expect(result.reason).toMatch(/paused/);
  });
});

describe('shouldSync near-deadline buckets', () => {
  it('uses 2-hour buckets so two syncs in one 6-hour slot get distinct job ids', () => {
    const student = {
      id: 's1',
      timezone: 'America/Chicago',
      quietHours: { start: '22:00', end: '07:00' },
      nudgeIntensity: 'normal' as const,
      snoozedUntil: null,
      onboardingCompletedAt: new Date('2026-09-01T00:00:00Z'),
      syncPausedReason: null,
      lastSyncAt: new Date('2026-10-30T15:00:00Z'), // 10:00 local
    };
    const a = shouldSync(student, new Date('2026-10-30T17:30:00Z'), 2); // 12:30 local, 2.5h later
    expect(a.due).toBe(true);
    const b = shouldSync({ ...student, lastSyncAt: new Date('2026-10-30T17:30:00Z') }, new Date('2026-10-30T19:45:00Z'), 2); // 14:45 local
    expect(b.due).toBe(true);
    expect(a.bucket).not.toBe(b.bucket);
    const far = shouldSync(student, new Date('2026-10-30T17:30:00Z'), 20);
    expect(far.due).toBe(false);
  });
});
