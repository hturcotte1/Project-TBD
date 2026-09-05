import type { ApplicationItemDto } from '@apogee/shared/api';
import type { ItemKind } from '@apogee/shared/domain';
import { ITEM_KINDS } from '@apogee/shared/domain';
import { describe, expect, it } from 'vitest';
import { CHECKLIST_GROUP_NAMES, checklistGroupForKind, groupChecklistItems } from '@/components/schools/checklist-groups';

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

describe('checklistGroupForKind', () => {
  it('maps every ItemKind to one of the six fixed groups', () => {
    for (const kind of ITEM_KINDS) {
      expect(CHECKLIST_GROUP_NAMES).toContain(checklistGroupForKind(kind));
    }
  });

  it('groups the kinds the requirements engine actually produces where the group name says it should', () => {
    expect(checklistGroupForKind('common_app_section')).toBe('Common App sections');
    expect(checklistGroupForKind('college_questions')).toBe('College questions & supplements');
    expect(checklistGroupForKind('supplement_essay')).toBe('College questions & supplements');
    expect(checklistGroupForKind('teacher_rec')).toBe('Recommendations');
    expect(checklistGroupForKind('counselor_rec')).toBe('Recommendations');
    expect(checklistGroupForKind('other_rec')).toBe('Recommendations');
    expect(checklistGroupForKind('test_scores')).toBe('Tests & scores');
    expect(checklistGroupForKind('score_send')).toBe('Tests & scores');
    expect(checklistGroupForKind('fafsa')).toBe('Financial aid & fees');
    expect(checklistGroupForKind('css_profile')).toBe('Financial aid & fees');
    expect(checklistGroupForKind('application_fee')).toBe('Financial aid & fees');
    expect(checklistGroupForKind('fee_waiver')).toBe('Financial aid & fees');
    expect(checklistGroupForKind('custom')).toBe('Custom');
  });
});

describe('groupChecklistItems', () => {
  it('buckets a mixed item list into the right groups', () => {
    const items = [
      item({ id: 'sec', kind: 'common_app_section' }),
      item({ id: 'q', kind: 'college_questions' }),
      item({ id: 'sup', kind: 'supplement_essay' }),
      item({ id: 'teacher', kind: 'teacher_rec' }),
      item({ id: 'score', kind: 'score_send' }),
      item({ id: 'fafsa', kind: 'fafsa' }),
      item({ id: 'own', kind: 'custom', source: 'student' }),
    ];
    const groups = groupChecklistItems(items);
    expect(groups['Common App sections'].map((i) => i.rule_key)).toEqual(['sec']);
    expect(groups['College questions & supplements'].map((i) => i.rule_key).sort()).toEqual(['q', 'sup']);
    expect(groups.Recommendations.map((i) => i.rule_key)).toEqual(['teacher']);
    expect(groups['Tests & scores'].map((i) => i.rule_key)).toEqual(['score']);
    expect(groups['Financial aid & fees'].map((i) => i.rule_key)).toEqual(['fafsa']);
    expect(groups.Custom.map((i) => i.rule_key)).toEqual(['own']);
  });

  it('produces every group key even when a group has no items', () => {
    const groups = groupChecklistItems([]);
    for (const name of CHECKLIST_GROUP_NAMES) {
      expect(groups[name]).toEqual([]);
    }
  });

  it('sorts each group by importance descending, then title', () => {
    const items = [
      item({ id: 'low', kind: 'college_questions', title: 'Z low', importance: 10 }),
      item({ id: 'high', kind: 'college_questions', title: 'A high', importance: 90 }),
      item({ id: 'tie-b', kind: 'college_questions', title: 'B tie', importance: 50 }),
      item({ id: 'tie-a', kind: 'college_questions', title: 'A tie', importance: 50 }),
    ];
    const groups = groupChecklistItems(items);
    expect(groups['College questions & supplements'].map((i) => i.title)).toEqual(['A high', 'A tie', 'B tie', 'Z low']);
  });
});
