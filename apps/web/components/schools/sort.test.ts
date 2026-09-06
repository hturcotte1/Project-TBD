import type { ApplicationDto, ApplicationItemDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import {
  compareDaysRemaining,
  groupApplications,
  isSubmittedApplication,
  openChecklistItems,
  sortApplications,
  sortApplicationsByColumn,
} from '@/components/schools/sort';

function app(overrides: Partial<ApplicationDto> & { id: string }): ApplicationDto {
  return {
    school: { id: overrides.id, slug: overrides.id, name: overrides.id, ceeb_code: null, common_app_member: true, portal_url: null, website: null, city: 'City', state: 'ST', type: 'private' },
    plan: 'RD',
    deadline: '2026-11-01',
    deadline_source: 'internal_dataset',
    days_remaining: 30,
    status: 'in_progress',
    decision: null,
    self_assessment: null,
    submitted_at: null,
    last_synced_at: null,
    notes: '',
    counts: { total: 10, done: 3, missing: 5, in_progress: 2, blocked: 0, not_applicable: 0 },
    completion_percent: 30,
    common_app_url: null,
    ...overrides,
  };
}

describe('isSubmittedApplication', () => {
  it('treats submitted and decision_received as submitted', () => {
    expect(isSubmittedApplication(app({ id: 'a', status: 'submitted' }))).toBe(true);
    expect(isSubmittedApplication(app({ id: 'b', status: 'decision_received' }))).toBe(true);
  });

  it('treats everything else as active', () => {
    expect(isSubmittedApplication(app({ id: 'c', status: 'not_started' }))).toBe(false);
    expect(isSubmittedApplication(app({ id: 'd', status: 'in_progress' }))).toBe(false);
    expect(isSubmittedApplication(app({ id: 'e', status: 'ready_to_submit' }))).toBe(false);
  });
});

describe('sortApplications', () => {
  it('orders active applications by nearest deadline first', () => {
    const far = app({ id: 'far', days_remaining: 90 });
    const near = app({ id: 'near', days_remaining: 5 });
    const mid = app({ id: 'mid', days_remaining: 30 });
    const sorted = sortApplications([far, near, mid]);
    expect(sorted.map((a) => a.id)).toEqual(['near', 'mid', 'far']);
  });

  it('sinks submitted applications to the bottom regardless of deadline', () => {
    const submittedSoon = app({ id: 'submitted-soon', days_remaining: 1, status: 'submitted' });
    const activeLater = app({ id: 'active-later', days_remaining: 60, status: 'in_progress' });
    const decisionSoon = app({ id: 'decision-soon', days_remaining: 2, status: 'decision_received' });
    const sorted = sortApplications([submittedSoon, activeLater, decisionSoon]);
    expect(sorted.map((a) => a.id)).toEqual(['active-later', 'submitted-soon', 'decision-soon']);
  });

  it('breaks deadline ties by school name', () => {
    const zeta = app({ id: 'zeta', days_remaining: 10, school: { id: 'z', slug: 'zeta', name: 'Zeta University', ceeb_code: null, common_app_member: true, portal_url: null, website: null, city: 'C', state: 'S', type: 'private' } });
    const alpha = app({ id: 'alpha', days_remaining: 10, school: { id: 'a', slug: 'alpha', name: 'Alpha College', ceeb_code: null, common_app_member: true, portal_url: null, website: null, city: 'C', state: 'S', type: 'private' } });
    const sorted = sortApplications([zeta, alpha]);
    expect(sorted.map((a) => a.id)).toEqual(['alpha', 'zeta']);
  });

  it('does not mutate the input array', () => {
    const list = [app({ id: 'a', days_remaining: 10 }), app({ id: 'b', days_remaining: 1 })];
    const copy = [...list];
    sortApplications(list);
    expect(list).toEqual(copy);
  });
});

describe('groupApplications', () => {
  it('splits into active and submitted, each sorted by deadline', () => {
    const submittedFar = app({ id: 'submitted-far', days_remaining: 100, status: 'submitted' });
    const submittedNear = app({ id: 'submitted-near', days_remaining: 10, status: 'submitted' });
    const activeNear = app({ id: 'active-near', days_remaining: 3, status: 'not_started' });
    const active = app({ id: 'active', days_remaining: 20, status: 'in_progress' });
    const grouped = groupApplications([submittedFar, submittedNear, activeNear, active]);
    expect(grouped.active.map((a) => a.id)).toEqual(['active-near', 'active']);
    expect(grouped.submitted.map((a) => a.id)).toEqual(['submitted-near', 'submitted-far']);
  });

  it('returns empty arrays when there is nothing in a group', () => {
    const grouped = groupApplications([app({ id: 'a', status: 'in_progress' })]);
    expect(grouped.submitted).toEqual([]);
    expect(grouped.active).toHaveLength(1);
  });
});

describe('compareDaysRemaining', () => {
  it('orders ascending by day count', () => {
    expect(compareDaysRemaining(5, 10, 'asc')).toBeLessThan(0);
    expect(compareDaysRemaining(10, 5, 'asc')).toBeGreaterThan(0);
  });

  it('flips for descending', () => {
    expect(compareDaysRemaining(5, 10, 'desc')).toBeGreaterThan(0);
  });

  it('sorts a null deadline after any number, in either direction', () => {
    expect(compareDaysRemaining(null, 5, 'asc')).toBeGreaterThan(0);
    expect(compareDaysRemaining(5, null, 'asc')).toBeLessThan(0);
    expect(compareDaysRemaining(null, 5, 'desc')).toBeGreaterThan(0);
    expect(compareDaysRemaining(5, null, 'desc')).toBeLessThan(0);
  });

  it('treats two null deadlines as equal', () => {
    expect(compareDaysRemaining(null, null, 'asc')).toBe(0);
  });
});

describe('sortApplicationsByColumn', () => {
  const alpha = app({ id: 'alpha', days_remaining: 30, completion_percent: 80, school: { id: 'a', slug: 'alpha', name: 'Alpha College', ceeb_code: null, common_app_member: true, portal_url: null, website: null, city: 'C', state: 'S', type: 'private' } });
  const zeta = app({ id: 'zeta', days_remaining: 10, completion_percent: 20, school: { id: 'z', slug: 'zeta', name: 'Zeta University', ceeb_code: null, common_app_member: true, portal_url: null, website: null, city: 'C', state: 'S', type: 'private' } });

  it('sorts by school name', () => {
    expect(sortApplicationsByColumn([zeta, alpha], { column: 'name', direction: 'asc' }).map((a) => a.id)).toEqual(['alpha', 'zeta']);
    expect(sortApplicationsByColumn([zeta, alpha], { column: 'name', direction: 'desc' }).map((a) => a.id)).toEqual(['zeta', 'alpha']);
  });

  it('sorts by deadline, ascending by default', () => {
    expect(sortApplicationsByColumn([alpha, zeta], { column: 'deadline', direction: 'asc' }).map((a) => a.id)).toEqual(['zeta', 'alpha']);
  });

  it('sorts by completion percent', () => {
    expect(sortApplicationsByColumn([alpha, zeta], { column: 'completion', direction: 'asc' }).map((a) => a.id)).toEqual(['zeta', 'alpha']);
    expect(sortApplicationsByColumn([alpha, zeta], { column: 'completion', direction: 'desc' }).map((a) => a.id)).toEqual(['alpha', 'zeta']);
  });

  it('does not mutate the input array', () => {
    const list = [alpha, zeta];
    const copy = [...list];
    sortApplicationsByColumn(list, { column: 'name', direction: 'asc' });
    expect(list).toEqual(copy);
  });
});

function item(overrides: Partial<ApplicationItemDto> & { id: string }): ApplicationItemDto {
  return {
    application_id: 'app-1',
    rule_key: overrides.id,
    kind: 'custom',
    title: overrides.id,
    description: '',
    source: 'student',
    status: 'missing',
    evidence: null,
    due_date: null,
    importance: 50,
    effort: 'small',
    depends_on_others: false,
    blocking: false,
    student_edited: false,
    notes: '',
    essay_id: null,
    recommender_id: null,
    last_checked_at: null,
    completed_at: null,
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('openChecklistItems', () => {
  it('keeps only missing, in_progress and blocked items', () => {
    const items = [
      item({ id: 'missing', status: 'missing' }),
      item({ id: 'in-progress', status: 'in_progress' }),
      item({ id: 'blocked', status: 'blocked' }),
      item({ id: 'done', status: 'done' }),
      item({ id: 'na', status: 'not_applicable' }),
    ];
    expect(openChecklistItems(items).map((i) => i.rule_key).sort()).toEqual(['blocked', 'in-progress', 'missing']);
  });

  it('orders by importance descending, then title, and caps to the limit', () => {
    const items = [
      item({ id: 'low', title: 'Z low', importance: 10 }),
      item({ id: 'high', title: 'A high', importance: 90 }),
      item({ id: 'mid-b', title: 'B mid', importance: 50 }),
      item({ id: 'mid-a', title: 'A mid', importance: 50 }),
    ];
    expect(openChecklistItems(items, 3).map((i) => i.rule_key)).toEqual(['high', 'mid-a', 'mid-b']);
  });
});
