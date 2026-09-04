import { describe, expect, it } from 'vitest';
import { computeNextActions, sendCap, topForIntensity } from './nextActions';
import type { PrioritizeApplication, PrioritizeInput, PrioritizeItem } from './types';

const TODAY = '2026-09-04';

function app(overrides: Partial<PrioritizeApplication> = {}): PrioritizeApplication {
  return {
    id: 'app-michigan',
    schoolName: 'Michigan',
    plan: 'EA',
    deadline: '2026-11-01',
    status: 'in_progress',
    ...overrides,
  };
}

function item(overrides: Partial<PrioritizeItem> = {}): PrioritizeItem {
  return {
    id: 'item-1',
    applicationId: 'app-michigan',
    schoolName: 'Michigan',
    ruleKey: 'supplement:why_us',
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
    ...overrides,
  };
}

describe('computeNextActions', () => {
  it('orders by score, ranks 1..n, and produces one action per item', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app()],
      items: [
        item({ id: 'far', dueDate: '2026-12-01' }),
        item({ id: 'blocking', kind: 'ferpa', blocking: true, dueDate: '2026-10-01' }),
        item({ id: 'near', dueDate: '2026-09-05' }),
      ],
    };
    const actions = computeNextActions(input);
    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.rank)).toEqual([1, 2, 3]);
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1]!.priorityScore).toBeGreaterThanOrEqual(actions[i]!.priorityScore);
    }
  });

  it('excludes items that are done or not_applicable', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app()],
      items: [
        item({ id: 'done', status: 'done' }),
        item({ id: 'na', status: 'not_applicable' }),
        item({ id: 'open', status: 'missing' }),
      ],
    };
    const actions = computeNextActions(input);
    expect(actions.map((a) => a.applicationItemId)).toEqual(['open']);
  });

  it('excludes items on submitted or decision_received applications', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app({ id: 'submitted-app', status: 'submitted' }), app({ id: 'active-app', status: 'in_progress' })],
      items: [
        item({ id: 'closed', applicationId: 'submitted-app' }),
        item({ id: 'open', applicationId: 'active-app' }),
      ],
    };
    const actions = computeNextActions(input);
    expect(actions.map((a) => a.applicationItemId)).toEqual(['open']);
  });

  it('includes student-wide items (no application) untouched by application status', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [],
      items: [item({ id: 'fafsa', kind: 'fafsa', applicationId: null, schoolName: null, dueDate: '2026-10-01' })],
    };
    const actions = computeNextActions(input);
    expect(actions.map((a) => a.applicationItemId)).toEqual(['fafsa']);
  });

  it('breaks score ties by due date then title', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app()],
      items: [
        item({ id: 'z-later', title: 'Zebra', dueDate: '2026-12-01' }),
        item({ id: 'a-earlier', title: 'Aardvark', dueDate: '2026-11-01' }),
        item({ id: 'a-later', title: 'Antelope', dueDate: '2026-12-01' }),
      ],
    };
    const actions = computeNextActions(input);
    // 'a-earlier' has the nearest due date so it should outrank the Dec 1 pair on urgency alone.
    expect(actions[0]!.applicationItemId).toBe('a-earlier');
    // Among the two Dec 1 items (equal urgency, equal everything else), title breaks the tie.
    const decItems = actions.filter((a) => a.dueDate === '2026-12-01');
    expect(decItems.map((a) => a.applicationItemId)).toEqual(['a-later', 'z-later']);
  });

  it('is deterministic', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app()],
      items: [item({ id: 'one' }), item({ id: 'two', dueDate: '2026-09-10' })],
    };
    expect(computeNextActions(input)).toEqual(computeNextActions(input));
  });

  it('reason text names the school and how many days remain', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app({ schoolName: 'Michigan', deadline: '2026-09-16' })],
      items: [item({ dueDate: null })], // borrows the application deadline: 12 days out
    };
    const [action] = computeNextActions(input);
    expect(action!.daysRemaining).toBe(12);
    expect(action!.reason).toContain('Michigan');
    expect(action!.reason).toContain('12');
  });

  it('action text is a concrete imperative sentence using the item', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'normal',
      applications: [app()],
      items: [item({ title: 'Why Michigan', evidenceText: '143/550 words' })],
    };
    const [action] = computeNextActions(input);
    expect(action!.action).toBe('Finish the Why Michigan essay (143/550 words)');
  });
});

describe('sendCap / topForIntensity', () => {
  it('maps intensity to a daily message cap', () => {
    expect(sendCap('chill')).toBe(1);
    expect(sendCap('normal')).toBe(3);
    expect(sendCap('intense')).toBe(6);
  });

  it('takes only the top N for the given intensity', () => {
    const input: PrioritizeInput = {
      today: TODAY,
      nudgeIntensity: 'chill',
      applications: [app()],
      items: [
        item({ id: 'a', dueDate: '2026-09-05' }),
        item({ id: 'b', dueDate: '2026-09-06' }),
        item({ id: 'c', dueDate: '2026-09-07' }),
      ],
    };
    const actions = computeNextActions(input);
    expect(topForIntensity(actions, 'chill')).toHaveLength(1);
    expect(topForIntensity(actions, 'normal')).toHaveLength(3);
    expect(topForIntensity(actions, 'intense')).toHaveLength(3); // only 3 exist
    expect(topForIntensity(actions, 'chill')[0]).toEqual(actions[0]);
  });
});
