import { describe, expect, it } from 'vitest';
import { FixedClock } from '../time/clock';
import { evaluateTriggers } from './triggers';
import type { TriggerApplication, TriggerEssay, TriggerRecommender, TriggerState, TriggerStudent } from './types';

const NY = 'America/New_York';
const CHI = 'America/Chicago';

function student(overrides: Partial<TriggerStudent> = {}): TriggerStudent {
  return {
    id: 'student-1',
    timezone: NY,
    quietHours: { start: '22:00', end: '07:00' },
    nudgeIntensity: 'normal',
    snoozedUntil: null,
    onboardingCompletedAt: new Date('2026-01-01T00:00:00Z'),
    syncPausedReason: null,
    lastSyncAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

function application(overrides: Partial<TriggerApplication> = {}): TriggerApplication {
  return {
    id: 'app-michigan',
    schoolName: 'Michigan',
    plan: 'EA',
    deadline: '2026-11-01',
    status: 'in_progress',
    ...overrides,
  };
}

function baseState(overrides: Partial<TriggerState> = {}): TriggerState {
  return {
    student: student(),
    applications: [],
    items: [],
    recommenders: [],
    essays: [],
    sentTriggerKeys: new Set(),
    ...overrides,
  };
}

describe('onboarding gate', () => {
  it('fires nothing before onboarding completes', () => {
    const state = baseState({
      student: student({ onboardingCompletedAt: null }),
      applications: [application({ deadline: '2026-09-07' })], // 3 days out
    });
    const now = new Date('2026-09-04T14:00:00Z'); // 10am NY
    expect(evaluateTriggers(state, now)).toEqual([]);
  });
});

describe('deadline countdown', () => {
  it('fires exactly once at 3 days remaining, keyed by application and day count', () => {
    const state = baseState({ applications: [application({ deadline: '2026-09-07' })] });
    const now = new Date('2026-09-04T14:00:00Z'); // 10am NY, 3 days out
    const events = evaluateTriggers(state, now);
    const countdowns = events.filter((e) => e.kind === 'deadline_countdown');
    expect(countdowns).toHaveLength(1);
    expect(countdowns[0]!.trigger_key).toBe('deadline_countdown:app-michigan:3');
    expect(countdowns[0]!.days_remaining).toBe(3);
    expect(countdowns[0]!.facts.school).toBe('Michigan');
  });

  it('does not re-fire once the key has already been sent', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-07' })],
      sentTriggerKeys: new Set(['deadline_countdown:app-michigan:3']),
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'deadline_countdown')).toBe(false);
  });

  it('does not fire on days with no rule (e.g. 2 days out)', () => {
    const state = baseState({ applications: [application({ deadline: '2026-09-06' })] }); // 2 days out
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'deadline_countdown')).toBe(false);
  });

  it('only fires at/after 9am local, but any time later that day if missed', () => {
    const state = baseState({ applications: [application({ deadline: '2026-09-07' })] });
    const early = evaluateTriggers(state, new Date('2026-09-04T11:00:00Z')); // 7am NY
    expect(early.some((e) => e.kind === 'deadline_countdown')).toBe(false);

    const late = evaluateTriggers(state, new Date('2026-09-04T20:00:00Z')); // 4pm NY
    expect(late.some((e) => e.kind === 'deadline_countdown')).toBe(true);
  });

  it('skips submitted or decision_received applications', () => {
    const state = baseState({ applications: [application({ deadline: '2026-09-07', status: 'submitted' })] });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'deadline_countdown')).toBe(false);
  });
});

describe('deadline day-of', () => {
  it('does not fire before 9am local', () => {
    const state = baseState({ applications: [application({ deadline: '2026-09-04' })] });
    const now = new Date('2026-09-04T12:00:00Z'); // 8am NY
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'deadline_day_of')).toBe(false);
  });

  it('fires with always_send at/after 9am local, once', () => {
    const state = baseState({ applications: [application({ deadline: '2026-09-04' })] });
    const now = new Date('2026-09-04T13:05:00Z'); // 9:05am NY
    const events = evaluateTriggers(state, now);
    const dayOf = events.find((e) => e.kind === 'deadline_day_of');
    expect(dayOf).toBeDefined();
    expect(dayOf!.always_send).toBe(true);
    expect(dayOf!.priority).toBe(100);
    expect(dayOf!.trigger_key).toBe('deadline_day_of:app-michigan');
  });
});

describe('recommender inactivity', () => {
  function recommender(overrides: Partial<TriggerRecommender> = {}): TriggerRecommender {
    return {
      id: 'rec-park',
      name: 'Ms. Park',
      role: 'teacher',
      assignments: [{ applicationId: 'app-michigan', status: 'invited', invitedAt: '2026-08-20' }],
      ...overrides,
    };
  }

  it('fires once when invited >=14 days ago and the deadline is <21 days out', () => {
    // now = 2026-09-04; invited 2026-08-20 => 15 days since invite; deadline 2026-09-20 => 16 days out
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      recommenders: [recommender()],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    const events = evaluateTriggers(state, now).filter((e) => e.kind === 'recommender_inactivity');
    expect(events).toHaveLength(1);
    expect(events[0]!.facts.recommender).toBe('Ms. Park');
    expect(events[0]!.facts.school).toBe('Michigan');
    expect(events[0]!.facts.days_since_invite).toBe(15);
  });

  it('keeps the same key across the week (deduped by sentTriggerKeys), a new key after 8 more days', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      recommenders: [recommender()],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    const [first] = evaluateTriggers(state, now).filter((e) => e.kind === 'recommender_inactivity');
    expect(first).toBeDefined();

    const nextDay = new Date('2026-09-05T14:00:00Z');
    const [second] = evaluateTriggers(
      { ...state, sentTriggerKeys: new Set([first!.trigger_key]) },
      nextDay,
    ).filter((e) => e.kind === 'recommender_inactivity');
    expect(second).toBeUndefined(); // same ISO week -> same key -> already sent

    const muchLater = new Date('2026-09-12T14:00:00Z'); // 8 days later, new ISO week
    const [third] = evaluateTriggers(
      { ...state, sentTriggerKeys: new Set([first!.trigger_key]) },
      muchLater,
    ).filter((e) => e.kind === 'recommender_inactivity');
    expect(third).toBeDefined();
    expect(third!.trigger_key).not.toBe(first!.trigger_key);
  });

  it('does not fire before 14 days since invite', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      recommenders: [recommender({ assignments: [{ applicationId: 'app-michigan', status: 'invited', invitedAt: '2026-08-28' }] })], // 7 days
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'recommender_inactivity')).toBe(false);
  });

  it('does not fire once the deadline is 21+ days away', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-10-01' })], // 27 days out
      recommenders: [recommender()],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'recommender_inactivity')).toBe(false);
  });

  it('does not fire for a submitted assignment', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      recommenders: [recommender({ assignments: [{ applicationId: 'app-michigan', status: 'submitted', invitedAt: '2026-08-01' }] })],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'recommender_inactivity')).toBe(false);
  });
});

describe('essay staleness', () => {
  function essay(overrides: Partial<TriggerEssay> = {}): TriggerEssay {
    return {
      id: 'essay-why-michigan',
      applicationId: 'app-michigan',
      title: 'Why Michigan',
      lastEditedAt: new Date('2026-08-25T12:00:00Z'),
      wordCount: 143,
      wordLimit: 550,
      itemStatus: 'in_progress',
      ...overrides,
    };
  }

  it('fires when stale (>=5 days since edit) and the deadline is <30 days out', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })], // 16 days out
      essays: [essay()], // last edited 2026-08-25 -> 10 days since edit
    });
    const now = new Date('2026-09-04T14:00:00Z');
    const events = evaluateTriggers(state, now).filter((e) => e.kind === 'essay_staleness');
    expect(events).toHaveLength(1);
    expect(events[0]!.facts.days_since_edit).toBe(10);
    expect(events[0]!.facts.word_count).toBe(143);
  });

  it('does not fire just under the staleness boundary (4 days since edit)', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      essays: [essay({ lastEditedAt: new Date('2026-08-31T12:00:00Z') })], // 4 days since edit
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'essay_staleness')).toBe(false);
  });

  it('fires right at the 5-day boundary', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      essays: [essay({ lastEditedAt: new Date('2026-08-30T12:00:00Z') })], // exactly 5 days
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'essay_staleness')).toBe(true);
  });

  it('treats a never-edited essay as stale once its deadline is <30 days out', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      essays: [essay({ lastEditedAt: null })],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    const [ev] = evaluateTriggers(state, now).filter((e) => e.kind === 'essay_staleness');
    expect(ev).toBeDefined();
    expect(ev!.facts.days_since_edit).toBe(null);
  });

  it('does not fire while the deadline is 30+ days away, even if stale', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-10-10' })], // 36 days out
      essays: [essay()],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'essay_staleness')).toBe(false);
  });

  it('does not fire once the item is marked done', () => {
    const state = baseState({
      applications: [application({ deadline: '2026-09-20' })],
      essays: [essay({ itemStatus: 'done' })],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'essay_staleness')).toBe(false);
  });
});

describe('score-send cutoff', () => {
  it('fires when a score_send item is open with a due date inside the cutoff window', () => {
    const state = baseState({
      items: [
        {
          id: 'item-scores',
          applicationId: 'app-michigan',
          schoolName: 'Michigan',
          ruleKey: 'score_send:sat',
          kind: 'score_send',
          title: 'Send SAT scores',
          status: 'missing',
          dueDate: '2026-09-06', // 2 days out
          importance: 60,
          effort: 'small',
          dependsOnOthers: false,
          blocking: false,
          notes: '',
          evidenceText: null,
        },
      ],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    const events = evaluateTriggers(state, now).filter((e) => e.kind === 'score_send_cutoff');
    expect(events).toHaveLength(1);
    expect(events[0]!.trigger_key).toBe('score_send_cutoff:item-scores');
  });

  it('does not fire outside the 3-day cutoff window', () => {
    const state = baseState({
      items: [
        {
          id: 'item-scores',
          applicationId: 'app-michigan',
          schoolName: 'Michigan',
          ruleKey: 'score_send:sat',
          kind: 'score_send',
          title: 'Send SAT scores',
          status: 'missing',
          dueDate: '2026-09-20', // 16 days out
          importance: 60,
          effort: 'small',
          dependsOnOthers: false,
          blocking: false,
          notes: '',
          evidenceText: null,
        },
      ],
    });
    const now = new Date('2026-09-04T14:00:00Z');
    expect(evaluateTriggers(state, now).some((e) => e.kind === 'score_send_cutoff')).toBe(false);
  });
});

describe('morning plan', () => {
  it('fires only inside the 07:30-09:00 window, and only with open items', () => {
    const withItems = baseState({
      items: [
        {
          id: 'item-1',
          applicationId: 'app-michigan',
          schoolName: 'Michigan',
          ruleKey: 'x',
          kind: 'supplement_essay',
          title: 'Why Michigan',
          status: 'missing',
          dueDate: null,
          importance: 50,
          effort: 'medium',
          dependsOnOthers: false,
          blocking: false,
          notes: '',
          evidenceText: null,
        },
      ],
      applications: [application()],
    });

    const before = evaluateTriggers(withItems, new Date('2026-09-04T11:00:00Z')); // 7am NY
    expect(before.some((e) => e.kind === 'morning_plan')).toBe(false);

    const during = evaluateTriggers(withItems, new Date('2026-09-04T12:00:00Z')); // 8am NY
    const morning = during.filter((e) => e.kind === 'morning_plan');
    expect(morning).toHaveLength(1);
    expect(morning[0]!.trigger_key).toBe('morning_plan:2026-09-04');
    expect(morning[0]!.facts.open_items).toBe(1);

    const after = evaluateTriggers(withItems, new Date('2026-09-04T13:30:00Z')); // 9:30am NY
    expect(after.some((e) => e.kind === 'morning_plan')).toBe(false);
  });

  it('does not fire when there are no open items', () => {
    const state = baseState();
    const during = evaluateTriggers(state, new Date('2026-09-04T12:00:00Z')); // 8am NY
    expect(during.some((e) => e.kind === 'morning_plan')).toBe(false);
  });
});

describe('weekly plan', () => {
  it('fires only on Sunday at/after 18:00 local', () => {
    const state = baseState({ student: student({ timezone: CHI }) });

    // 2026-09-06 is a Sunday.
    const sundayEvening = evaluateTriggers(state, new Date('2026-09-06T23:30:00Z')); // 6:30pm Chicago
    expect(sundayEvening.some((e) => e.kind === 'weekly_plan')).toBe(true);

    const sundayAfternoon = evaluateTriggers(state, new Date('2026-09-06T20:00:00Z')); // 3pm Chicago
    expect(sundayAfternoon.some((e) => e.kind === 'weekly_plan')).toBe(false);

    const monday = evaluateTriggers(state, new Date('2026-09-07T23:30:00Z')); // Monday 6:30pm Chicago
    expect(monday.some((e) => e.kind === 'weekly_plan')).toBe(false);
  });
});

describe('fixed clock sanity', () => {
  it('uses only the given clock, never the wall clock', () => {
    const clock = new FixedClock('2026-09-04T14:00:00Z');
    const state = baseState({ applications: [application({ deadline: '2026-09-07' })] });
    const a = evaluateTriggers(state, clock.now());
    clock.advance(1000);
    const b = evaluateTriggers(state, clock.now());
    expect(a).toEqual(b);
  });
});

describe('personal essay staleness', () => {
  it('measures the personal essay against the earliest open deadline', () => {
    const now = new Date('2026-10-20T16:00:00Z'); // 11:00 Chicago, 12 days before Nov 1
    const state: TriggerState = {
      student: {
        id: 's1',
        timezone: 'America/Chicago',
        quietHours: { start: '22:00', end: '07:00' },
        nudgeIntensity: 'normal',
        snoozedUntil: null,
        onboardingCompletedAt: new Date('2026-09-01T00:00:00Z'),
        syncPausedReason: null,
        lastSyncAt: null,
      },
      applications: [
        { id: 'a1', schoolName: 'University of Michigan', plan: 'EA', deadline: '2026-11-01', status: 'in_progress' },
        { id: 'a2', schoolName: 'Emory University', plan: 'RD', deadline: '2027-01-01', status: 'in_progress' },
      ],
      items: [],
      recommenders: [],
      essays: [
        { id: 'e-personal', applicationId: null, title: 'Personal essay', lastEditedAt: new Date('2026-10-01T00:00:00Z'), wordCount: 400, wordLimit: 650, itemStatus: 'in_progress' },
      ],
      sentTriggerKeys: new Set(),
    };
    const events = evaluateTriggers(state, now);
    const stale = events.filter((e) => e.kind === 'essay_staleness');
    expect(stale).toHaveLength(1);
    expect(stale[0]?.facts.school).toBe('University of Michigan');
    expect(stale[0]?.days_remaining).toBe(12);
  });
});
