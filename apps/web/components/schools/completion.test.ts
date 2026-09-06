import type { ApplicationItemDto } from '@apogee/shared/api';
import type { ItemKind, ItemStatus } from '@apogee/shared/domain';
import { describe, expect, it } from 'vitest';
import { completionByApplication, completionGroups } from '@/components/schools/completion';

function item(overrides: Partial<ApplicationItemDto> & { id: string; kind: ItemKind }): ApplicationItemDto {
  return {
    application_id: 'app-1',
    rule_key: overrides.id,
    title: overrides.id,
    description: '',
    source: 'common_app',
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

describe('completionGroups', () => {
  it('reports every group, even ones with nothing in them', () => {
    const groups = completionGroups([]);
    expect(groups.map((g) => g.label)).toEqual([
      'Common App sections',
      'College questions and supplements',
      'Recommendations',
      'Tests and scores',
      'Financial aid and fees',
      'Custom',
    ]);
    expect(groups.every((g) => g.total === 0 && g.done === 0)).toBe(true);
  });

  it('counts done and total per group', () => {
    const items = [
      item({ id: 'a', kind: 'common_app_section', status: 'done' }),
      item({ id: 'b', kind: 'common_app_section', status: 'missing' }),
      item({ id: 'c', kind: 'teacher_rec', status: 'done' }),
    ];
    const groups = completionGroups(items);
    const commonApp = groups.find((g) => g.label === 'Common App sections')!;
    const recs = groups.find((g) => g.label === 'Recommendations')!;
    expect(commonApp).toMatchObject({ done: 1, total: 2 });
    expect(recs).toMatchObject({ done: 1, total: 1 });
  });

  it('excludes not_applicable items from both done and total', () => {
    const items: ApplicationItemDto[] = [
      item({ id: 'a', kind: 'test_scores', status: 'not_applicable' }),
      item({ id: 'b', kind: 'test_scores', status: 'done' }),
    ];
    const groups = completionGroups(items);
    const tests = groups.find((g) => g.label === 'Tests and scores')!;
    expect(tests).toMatchObject({ done: 1, total: 1 });
  });

  it('never counts not_applicable as done even when every item is not_applicable', () => {
    const groups = completionGroups([item({ id: 'a', kind: 'fafsa', status: 'not_applicable' as ItemStatus })]);
    const aid = groups.find((g) => g.label === 'Financial aid and fees')!;
    expect(aid).toMatchObject({ done: 0, total: 0 });
  });
});

describe('completionByApplication', () => {
  it('buckets items by application_id and skips items with none', () => {
    const items = [
      item({ id: 'a', kind: 'common_app_section', application_id: 'app-1', status: 'done' }),
      item({ id: 'b', kind: 'common_app_section', application_id: 'app-2', status: 'missing' }),
      item({ id: 'c', kind: 'custom', application_id: null }),
    ];
    const byApp = completionByApplication(items);
    expect(Object.keys(byApp).sort()).toEqual(['app-1', 'app-2']);
    const app1CommonApp = byApp['app-1']!.find((g) => g.label === 'Common App sections')!;
    expect(app1CommonApp).toMatchObject({ done: 1, total: 1 });
  });

  it('returns an empty object for an empty item list', () => {
    expect(completionByApplication([])).toEqual({});
  });
});
