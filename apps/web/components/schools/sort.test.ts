import type { ApplicationDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import { groupApplications, isSubmittedApplication, sortApplications } from '@/components/schools/sort';

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
