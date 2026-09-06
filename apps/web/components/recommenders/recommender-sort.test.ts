import type { ApplicationDto, RecommenderAssignmentDto, RecommenderDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import { formatDeadlineDate, nearestDeadline, sortRecommenders } from '@/components/recommenders/recommender-sort';

function assignment(overrides: Partial<RecommenderAssignmentDto> & { id: string; application_id: string; deadline: string }): RecommenderAssignmentDto {
  return { school_name: 'A school', status: 'pending', invited_at: null, submitted_at: null, evidence: null, ...overrides };
}

function recommender(overrides: Partial<RecommenderDto> & { id: string; name: string; assignments: RecommenderAssignmentDto[] }): RecommenderDto {
  return { role: 'teacher', email: null, subject: null, invite_status: 'not_invited', invited_at: null, last_nudged_at: null, notes: '', ...overrides };
}

function applicationsById(entries: Array<[string, number]>): Map<string, ApplicationDto> {
  const map = new Map<string, ApplicationDto>();
  for (const [id, daysRemaining] of entries) {
    map.set(id, {
      id,
      school: { id, name: id, slug: id },
      plan: 'RD',
      deadline: '2026-11-01',
      deadline_source: 'manual',
      days_remaining: daysRemaining,
      status: 'in_progress',
      decision: null,
      self_assessment: null,
      submitted_at: null,
      last_synced_at: null,
      notes: '',
      counts: { total: 0, done: 0, not_applicable: 0 },
      completion_percent: 0,
      common_app_url: null,
    } as unknown as ApplicationDto);
  }
  return map;
}

describe('formatDeadlineDate', () => {
  it('formats without a weekday, unlike lib/format.ts formatDate', () => {
    expect(formatDeadlineDate('2026-11-01', 'America/Chicago')).toBe('Nov 1');
  });
});

describe('nearestDeadline', () => {
  it('is null for a recommender with no assignments', () => {
    expect(nearestDeadline(recommender({ id: 'r1', name: 'Ms. Park', assignments: [] }), new Map())).toBeNull();
  });

  it('picks the earliest deadline among several assignments', () => {
    const r = recommender({
      id: 'r1',
      name: 'Ms. Park',
      assignments: [
        assignment({ id: 'a1', application_id: 'app-1', deadline: '2026-11-15' }),
        assignment({ id: 'a2', application_id: 'app-2', deadline: '2026-10-01' }),
      ],
    });
    const result = nearestDeadline(r, applicationsById([['app-2', 12]]));
    expect(result).toEqual({ deadline: '2026-10-01', daysRemaining: 12 });
  });

  it('falls back to null days remaining when no matching application is found', () => {
    const r = recommender({ id: 'r1', name: 'Ms. Park', assignments: [assignment({ id: 'a1', application_id: 'app-1', deadline: '2026-11-01' })] });
    expect(nearestDeadline(r, new Map())?.daysRemaining).toBeNull();
  });
});

describe('sortRecommenders', () => {
  it('orders by nearest deadline ascending', () => {
    const soon = recommender({ id: 'r1', name: 'Zeta', assignments: [assignment({ id: 'a1', application_id: 'app-1', deadline: '2026-09-10' })] });
    const later = recommender({ id: 'r2', name: 'Alpha', assignments: [assignment({ id: 'a2', application_id: 'app-2', deadline: '2026-11-01' })] });
    const result = sortRecommenders([later, soon], applicationsById([['app-1', 5], ['app-2', 57]]));
    expect(result.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('breaks ties on the same deadline by name', () => {
    const b = recommender({ id: 'r1', name: 'Beta', assignments: [assignment({ id: 'a1', application_id: 'app-1', deadline: '2026-11-01' })] });
    const a = recommender({ id: 'r2', name: 'Alpha', assignments: [assignment({ id: 'a2', application_id: 'app-2', deadline: '2026-11-01' })] });
    const result = sortRecommenders([b, a], applicationsById([['app-1', 10], ['app-2', 10]]));
    expect(result.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
  });

  it('sorts recommenders with no schools to the end', () => {
    const withSchool = recommender({ id: 'r1', name: 'Zeta', assignments: [assignment({ id: 'a1', application_id: 'app-1', deadline: '2026-11-01' })] });
    const withoutSchool = recommender({ id: 'r2', name: 'Alpha', assignments: [] });
    const result = sortRecommenders([withoutSchool, withSchool], applicationsById([['app-1', 10]]));
    expect(result.map((r) => r.id)).toEqual(['r1', 'r2']);
  });
});
