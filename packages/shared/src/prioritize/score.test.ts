import { describe, expect, it } from 'vitest';
import { scoreItem } from './score';
import type { PrioritizeApplication, PrioritizeItem } from './types';

const TODAY = '2026-09-04';

function app(overrides: Partial<PrioritizeApplication> = {}): PrioritizeApplication {
  return {
    id: 'app-1',
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
    applicationId: 'app-1',
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

describe('scoreItem: urgency', () => {
  it('grows sharply as the deadline nears', () => {
    const far = scoreItem(item({ dueDate: '2026-11-03' }), null, TODAY); // 60 days out
    const month = scoreItem(item({ dueDate: '2026-10-04' }), null, TODAY); // 30 days out
    const week = scoreItem(item({ dueDate: '2026-09-11' }), null, TODAY); // 7 days out
    const tomorrow = scoreItem(item({ dueDate: '2026-09-05' }), null, TODAY); // 1 day out

    expect(far.parts.urgency).toBeLessThan(month.parts.urgency);
    expect(month.parts.urgency).toBeLessThan(week.parts.urgency);
    expect(week.parts.urgency).toBeLessThan(tomorrow.parts.urgency);
  });

  it('maxes out at <=1 day and stays maxed while overdue', () => {
    const dueTomorrow = scoreItem(item({ dueDate: '2026-09-05' }), null, TODAY);
    const dueToday = scoreItem(item({ dueDate: TODAY }), null, TODAY);
    const overdue = scoreItem(item({ dueDate: '2026-08-20' }), null, TODAY);

    expect(dueTomorrow.parts.urgency).toBe(dueToday.parts.urgency);
    expect(overdue.parts.urgency).toBe(dueTomorrow.parts.urgency);
  });

  it('falls back to the application deadline when the item has none', () => {
    const withOwnDate = scoreItem(item({ dueDate: '2026-09-11' }), app({ deadline: '2026-12-25' }), TODAY);
    const borrowed = scoreItem(item({ dueDate: null }), app({ deadline: '2026-09-11' }), TODAY);
    expect(borrowed.parts.urgency).toBe(withOwnDate.parts.urgency);
  });

  it('uses a low flat urgency when there is no due date and no application', () => {
    const { parts } = scoreItem(item({ dueDate: null, applicationId: null }), null, TODAY);
    const closeItem = scoreItem(item({ dueDate: '2026-09-05' }), null, TODAY);
    expect(parts.urgency).toBeGreaterThan(0);
    expect(parts.urgency).toBeLessThan(closeItem.parts.urgency);
  });
});

describe('scoreItem: dependency', () => {
  it('pulls a same-due-date recommender item ahead of a student-only item', () => {
    const due = '2026-09-24'; // 20 days out
    const rec = scoreItem(item({ kind: 'teacher_rec', dueDate: due, dependsOnOthers: true }), null, TODAY);
    const essay = scoreItem(item({ kind: 'supplement_essay', dueDate: due, dependsOnOthers: false }), null, TODAY);
    expect(rec.parts.dependency).toBeGreaterThan(0);
    expect(essay.parts.dependency).toBe(0);
    expect(rec.score).toBeGreaterThan(essay.score);
  });

  it('never makes dependency negative, even very close to the deadline', () => {
    const { parts } = scoreItem(item({ dueDate: TODAY, dependsOnOthers: true }), null, TODAY);
    expect(parts.dependency).toBeGreaterThanOrEqual(0);
  });
});

describe('scoreItem: blocking', () => {
  it('puts blocking items (FERPA, required supplements) ahead of otherwise-similar items', () => {
    const due = '2026-10-04'; // 30 days out for both
    const blocking = scoreItem(item({ kind: 'ferpa', dueDate: due, blocking: true }), null, TODAY);
    const normal = scoreItem(item({ kind: 'supplement_essay', dueDate: due, blocking: false }), null, TODAY);
    expect(blocking.score).toBeGreaterThan(normal.score);
  });
});

describe('scoreItem: effort', () => {
  it('boosts small tasks near the deadline more than far from it', () => {
    const nearSmall = scoreItem(item({ effort: 'small', dueDate: '2026-09-05' }), null, TODAY);
    const farSmall = scoreItem(item({ effort: 'small', dueDate: '2026-11-03' }), null, TODAY);
    expect(nearSmall.parts.effort).toBeGreaterThan(farSmall.parts.effort);
  });

  it('boosts large tasks far from the deadline more than near it', () => {
    const nearLarge = scoreItem(item({ effort: 'large', dueDate: '2026-09-05' }), null, TODAY);
    const farLarge = scoreItem(item({ effort: 'large', dueDate: '2026-11-03' }), null, TODAY);
    expect(farLarge.parts.effort).toBeGreaterThan(nearLarge.parts.effort);
  });

  it('near a deadline, a small task outranks a same-urgency large task', () => {
    const due = '2026-09-05';
    const small = scoreItem(item({ effort: 'small', dueDate: due }), null, TODAY);
    const large = scoreItem(item({ effort: 'large', dueDate: due }), null, TODAY);
    expect(small.score).toBeGreaterThan(large.score);
  });

  it('far from a deadline, a large task outranks a same-urgency small task', () => {
    const due = '2026-11-03';
    const small = scoreItem(item({ effort: 'small', dueDate: due }), null, TODAY);
    const large = scoreItem(item({ effort: 'large', dueDate: due }), null, TODAY);
    expect(large.score).toBeGreaterThan(small.score);
  });
});

describe('scoreItem: importance', () => {
  it('scales the whole score up and down', () => {
    const low = scoreItem(item({ importance: 10, dueDate: '2026-09-11' }), null, TODAY);
    const baseline = scoreItem(item({ importance: 50, dueDate: '2026-09-11' }), null, TODAY);
    const high = scoreItem(item({ importance: 90, dueDate: '2026-09-11' }), null, TODAY);
    expect(low.score).toBeLessThan(baseline.score);
    expect(baseline.score).toBeLessThan(high.score);
    expect(baseline.parts.importance).toBe(1);
  });

  it('never lets importance zero out the score entirely', () => {
    const { score } = scoreItem(item({ importance: 0, dueDate: '2026-09-05' }), null, TODAY);
    expect(score).toBeGreaterThan(0);
  });
});

describe('scoreItem: determinism', () => {
  it('is a pure function of its inputs', () => {
    const a = scoreItem(item(), app(), TODAY);
    const b = scoreItem(item(), app(), TODAY);
    expect(a).toEqual(b);
  });
});
