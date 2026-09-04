import { describe, expect, it } from 'vitest';
import type { TriggerEvent } from '../schemas/proactive';
import { planNudges } from './policy';
import type { NudgePlanInput } from './policy';

const NY = 'America/New_York';

let counter = 0;
function trigger(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  counter += 1;
  return {
    kind: 'deadline_countdown',
    trigger_key: `key-${counter}`,
    application_id: null,
    application_item_id: null,
    recommender_id: null,
    essay_id: null,
    due_date: null,
    days_remaining: null,
    facts: {},
    always_send: false,
    priority: 50,
    ...overrides,
  };
}

function baseInput(overrides: Partial<NudgePlanInput> = {}): NudgePlanInput {
  return {
    now: new Date('2026-09-04T18:00:00Z'), // 2pm NY: not quiet hours
    timezone: NY,
    quietHours: { start: '22:00', end: '07:00' },
    intensity: 'normal',
    snoozedUntil: null,
    candidates: [],
    sentTodayCount: 0,
    suppressedItemIds: new Set(),
    ...overrides,
  };
}

describe('planNudges: quiet hours and snoozing', () => {
  it('defers everything except always_send during quiet hours, with the correct deferUntil', () => {
    const now = new Date('2026-09-05T03:00:00Z'); // 11pm NY (quiet hours 22:00-07:00)
    const normal = trigger({ priority: 80 });
    const urgent = trigger({ always_send: true, priority: 100 });
    const plan = planNudges(baseInput({ now, candidates: [normal, urgent] }));

    expect(plan.batches.flat()).toEqual([urgent]);
    expect(plan.deferUntil?.toISOString()).toBe('2026-09-05T11:00:00.000Z'); // 7am NY
    expect(plan.dropped).toEqual([]); // deferred, not dropped
  });

  it('defers non-always_send while snoozed, using snoozedUntil as deferUntil', () => {
    const now = new Date('2026-09-04T18:00:00Z'); // 2pm NY, not quiet hours
    const snoozedUntil = new Date('2026-09-04T20:00:00Z');
    const t = trigger();
    const plan = planNudges(baseInput({ now, snoozedUntil, candidates: [t] }));
    expect(plan.batches).toEqual([]);
    expect(plan.deferUntil).toEqual(snoozedUntil);
  });

  it('uses whichever of quiet-hours-end or snoozedUntil is later', () => {
    const now = new Date('2026-09-05T03:00:00Z'); // 11pm NY, quiet hours end at 7am NY (11:00Z next day)
    const snoozedUntil = new Date('2026-09-05T15:00:00Z'); // later than quiet hours end
    const t = trigger();
    const plan = planNudges(baseInput({ now, snoozedUntil, candidates: [t] }));
    expect(plan.deferUntil).toEqual(snoozedUntil);
  });

  it('does not defer outside quiet hours and without a snooze', () => {
    const t = trigger();
    const plan = planNudges(baseInput({ candidates: [t] }));
    expect(plan.deferUntil).toBeNull();
    expect(plan.batches.flat()).toEqual([t]);
  });
});

describe('planNudges: suppression', () => {
  it('drops triggers whose application_item_id is suppressed', () => {
    const suppressed = trigger({ application_item_id: 'item-1' });
    const kept = trigger({ application_item_id: 'item-2' });
    const plan = planNudges(baseInput({ candidates: [suppressed, kept], suppressedItemIds: new Set(['item-1']) }));
    expect(plan.batches.flat()).toEqual([kept]);
    expect(plan.dropped).toEqual([{ trigger: suppressed, reason: 'suppressed' }]);
  });
});

describe('planNudges: duplicates', () => {
  it('dedupes identical trigger_keys, keeping the first', () => {
    const t = trigger({ trigger_key: 'same-key' });
    const dupe = { ...t };
    const plan = planNudges(baseInput({ candidates: [t, dupe] }));
    expect(plan.batches.flat()).toEqual([t]);
    expect(plan.dropped).toEqual([{ trigger: dupe, reason: 'duplicate' }]);
  });
});

describe('planNudges: batching', () => {
  it('batches triggers that share an application_id into one message', () => {
    const a = trigger({ application_id: 'app-1', priority: 60 });
    const b = trigger({ application_id: 'app-1', priority: 70 });
    const other = trigger({ application_id: 'app-2', priority: 50 });
    const plan = planNudges(baseInput({ candidates: [a, b, other] }));
    expect(plan.batches).toHaveLength(2);
    const appOneBatch = plan.batches.find((batch) => batch.some((t) => t.application_id === 'app-1'));
    expect(appOneBatch).toBeDefined();
    expect(appOneBatch).toHaveLength(2);
  });

  it('keeps morning/weekly plan (no application_id) as standalone batches', () => {
    const morning = trigger({ kind: 'morning_plan', application_id: null, priority: 40 });
    const weekly = trigger({ kind: 'weekly_plan', application_id: null, priority: 50 });
    const plan = planNudges(baseInput({ candidates: [morning, weekly] }));
    expect(plan.batches).toHaveLength(2);
    expect(plan.batches.every((b) => b.length === 1)).toBe(true);
  });
});

describe('planNudges: daily cap', () => {
  it('caps the number of non-always_send batches sent, dropping the lowest-priority overflow', () => {
    const low = trigger({ application_id: 'app-low', priority: 10 });
    const mid = trigger({ application_id: 'app-mid', priority: 50 });
    const high = trigger({ application_id: 'app-high', priority: 90 });
    const plan = planNudges(baseInput({ intensity: 'chill', candidates: [low, mid, high] })); // cap = 1

    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0]).toEqual([high]);
    expect(plan.dropped).toHaveLength(2);
    expect(plan.dropped.every((d) => d.reason === 'cap')).toBe(true);
  });

  it('subtracts sentTodayCount from the cap', () => {
    const a = trigger({ application_id: 'app-a', priority: 50 });
    const b = trigger({ application_id: 'app-b', priority: 60 });
    const plan = planNudges(baseInput({ intensity: 'normal', sentTodayCount: 2, candidates: [a, b] })); // cap 3 - 2 = 1
    expect(plan.batches).toHaveLength(1);
    expect(plan.dropped).toHaveLength(1);
  });

  it('never drops always_send batches and does not count them against the cap', () => {
    const urgent1 = trigger({ application_id: 'app-1', always_send: true, priority: 100 });
    const urgent2 = trigger({ application_id: 'app-2', always_send: true, priority: 100 });
    const normal = trigger({ application_id: 'app-3', priority: 50 });
    const plan = planNudges(baseInput({ intensity: 'chill', sentTodayCount: 5, candidates: [urgent1, urgent2, normal] })); // cap already exhausted
    const flat = plan.batches.flat();
    expect(flat).toContainEqual(urgent1);
    expect(flat).toContainEqual(urgent2);
    expect(flat).not.toContainEqual(normal);
    expect(plan.dropped).toEqual([{ trigger: normal, reason: 'cap' }]);
  });
});

describe('planNudges: ordering', () => {
  it('orders batches by their highest-priority trigger, descending', () => {
    const low = trigger({ application_id: 'app-low', priority: 20 });
    const high = trigger({ application_id: 'app-high', priority: 90 });
    const mid = trigger({ application_id: 'app-mid', priority: 55 });
    const plan = planNudges(baseInput({ intensity: 'intense', candidates: [low, high, mid] }));
    expect(plan.batches.map((b) => b[0]!.application_id)).toEqual(['app-high', 'app-mid', 'app-low']);
  });
});
