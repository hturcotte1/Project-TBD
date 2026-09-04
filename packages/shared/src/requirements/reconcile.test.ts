import { describe, expect, it } from 'vitest';
import type { ApplicationItem } from '../db/schema';
import { reconcile } from './reconcile';
import type { ChecklistItemSpec } from './types';

const APPLICATION_ID = 'app-1';

let idCounter = 0;
function row(overrides: Partial<ApplicationItem> = {}): ApplicationItem {
  idCounter += 1;
  return {
    id: `row-${idCounter}`,
    studentId: 'student-1',
    applicationId: APPLICATION_ID,
    ruleKey: 'ferpa',
    kind: 'ferpa',
    title: 'FERPA release',
    description: 'Sign the FERPA waiver.',
    source: 'common_app',
    status: 'missing',
    evidence: null,
    dueDate: '2026-11-01',
    importance: 90,
    effort: 'small',
    dependsOnOthers: false,
    blocking: true,
    studentEdited: false,
    notes: '',
    essayId: null,
    recommenderId: null,
    lastCheckedAt: null,
    completedAt: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

function spec(overrides: Partial<ChecklistItemSpec> = {}): ChecklistItemSpec {
  return {
    ruleKey: 'ferpa',
    kind: 'ferpa',
    title: 'FERPA release',
    description: 'Sign the FERPA waiver.',
    source: 'common_app',
    status: 'missing',
    evidence: null,
    dueDate: '2026-11-01',
    importance: 90,
    effort: 'small',
    dependsOnOthers: false,
    blocking: true,
    ...overrides,
  };
}

describe('reconcile', () => {
  it('inserts items with no matching stored row', () => {
    const result = reconcile([], [spec({ ruleKey: 'ferpa' })], APPLICATION_ID);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0]?.ruleKey).toBe('ferpa');
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });

  it('produces no update for a row that has not changed', () => {
    const existing = row({ status: 'done' });
    const result = reconcile([existing], [spec({ status: 'done' })], APPLICATION_ID);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });

  it('deletes a rule item that no longer appears, unless student-edited', () => {
    const gone = row({ ruleKey: 'score_send', studentEdited: false });
    const kept = row({ ruleKey: 'transcript', studentEdited: true, id: 'row-kept' });
    const result = reconcile([gone, kept], [], APPLICATION_ID);
    expect(result.toDelete).toEqual([gone.id]);
  });

  it('never touches a custom, student-authored item', () => {
    const custom = row({ ruleKey: 'custom:pack-a-bag', source: 'student', studentEdited: false });
    const result = reconcile([custom], [], APPLICATION_ID);
    expect(result.toDelete).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);

    // Even if a fresh item happened to carry the exact same ruleKey, the custom row is not matched to it.
    const withCoincidentalKey = reconcile([custom], [spec({ ruleKey: 'custom:pack-a-bag', source: 'internal_rule' })], APPLICATION_ID);
    expect(withCoincidentalKey.toInsert).toHaveLength(1); // the fresh item is a fresh insert, not a match
    expect(withCoincidentalKey.toUpdate).toHaveLength(0);
  });

  it('a student-edited row keeps its status, but evidence/dueDate/title/description still refresh', () => {
    const existing = row({
      status: 'in_progress',
      studentEdited: true,
      title: 'FERPA release',
      description: 'Sign the FERPA waiver.',
      dueDate: '2026-11-01',
      evidence: { seen_at: '2026-09-01T00:00:00Z', text: 'old evidence', confidence: 0.5, source_url: null },
    });
    const fresh = spec({
      status: 'missing', // Common App now disagrees, but is not "done" so the student's status wins
      title: 'FERPA release (updated)',
      description: 'Sign the updated FERPA waiver.',
      dueDate: '2026-11-05',
      evidence: { seen_at: '2026-09-03T00:00:00Z', text: 'FERPA status unknown', confidence: 0.3, source_url: null },
    });
    const result = reconcile([existing], [fresh], APPLICATION_ID);
    expect(result.toUpdate).toHaveLength(1);
    const update = result.toUpdate[0]!;
    expect(update.id).toBe(existing.id);
    expect(update.set.status).toBeUndefined(); // status is not part of the diff — it was preserved
    expect(update.set.title).toBe('FERPA release (updated)');
    expect(update.set.description).toBe('Sign the updated FERPA waiver.');
    expect(update.set.dueDate).toBe('2026-11-05');
    expect(update.set.evidence?.text).toBe('FERPA status unknown');
  });

  it('Common App is the source of truth for completion: a student-edited row still flips to done', () => {
    const existing = row({ status: 'in_progress', studentEdited: true });
    const fresh = spec({ status: 'done' });
    const result = reconcile([existing], [fresh], APPLICATION_ID);
    expect(result.toUpdate).toHaveLength(1);
    const update = result.toUpdate[0]!;
    expect(update.set.status).toBe('done');
    expect(update.set.completedAt).toBeInstanceOf(Date);
  });

  it('sets completedAt when a non-edited row transitions to done, and clears it when it regresses', () => {
    const missing = row({ status: 'missing' });
    const toDone = reconcile([missing], [spec({ status: 'done' })], APPLICATION_ID);
    expect(toDone.toUpdate[0]?.set.status).toBe('done');
    expect(toDone.toUpdate[0]?.set.completedAt).toBeInstanceOf(Date);

    const done = row({ status: 'done', completedAt: new Date('2026-09-01T00:00:00Z') });
    const regressed = reconcile([done], [spec({ status: 'missing' })], APPLICATION_ID);
    expect(regressed.toUpdate[0]?.set.status).toBe('missing');
    expect(regressed.toUpdate[0]?.set.completedAt).toBeNull();
  });

  it('bumps lastCheckedAt whenever an update is produced', () => {
    const existing = row({ title: 'Old title' });
    const result = reconcile([existing], [spec({ title: 'New title' })], APPLICATION_ID);
    expect(result.toUpdate[0]?.set.lastCheckedAt).toBeInstanceOf(Date);
  });

  it('only reconciles rows scoped to the given applicationId', () => {
    const otherApp = row({ applicationId: 'app-2', ruleKey: 'ferpa' });
    const result = reconcile([otherApp], [spec({ ruleKey: 'ferpa' })], APPLICATION_ID);
    // The row for a different application is invisible to this scope, so the fresh item is a fresh insert.
    expect(result.toInsert).toHaveLength(1);
    expect(result.toDelete).toHaveLength(0);
  });

  it('handles the student-wide (applicationId null) scope the same way', () => {
    const existing = row({ applicationId: null, ruleKey: 'fafsa' });
    const result = reconcile([existing], [spec({ ruleKey: 'fafsa', status: 'missing' })], null);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);
  });
});
