/**
 * Diffs a freshly built checklist against the `application_items` rows already stored for one
 * scope (one application, or the student-wide `null` scope), matching by `ruleKey`. Common App is
 * the source of truth for completion, but a student's own edits to status/notes on a row survive
 * a re-sync unless the fresh data says the item is actually done.
 */
import type { ApplicationItem, NewApplicationItem } from '../db/schema';
import type { ItemEvidence } from '../schemas/items';
import type { ChecklistItemSpec } from './types';

export interface ReconcileResult {
  toInsert: ChecklistItemSpec[];
  toUpdate: Array<{ id: string; set: Partial<NewApplicationItem> }>;
  toDelete: string[];
}

function evidenceEqual(a: ItemEvidence | null | undefined, b: ItemEvidence | null): boolean {
  const left = a ?? null;
  if (left === null || b === null) return left === b;
  return left.seen_at === b.seen_at && left.text === b.text && left.confidence === b.confidence && left.source_url === b.source_url;
}

/**
 * Computes the field-level update for one existing row given the freshly built item, or `null`
 * when nothing relevant changed (no update is written in that case).
 */
function buildUpdate(existing: ApplicationItem, fresh: ChecklistItemSpec): Partial<NewApplicationItem> | null {
  // Common App is the source of truth for completion: a student-edited row keeps its own status
  // unless the fresh sync says the item is now done.
  const resolvedStatus = existing.studentEdited ? (fresh.status === 'done' ? 'done' : existing.status) : fresh.status;

  const set: Partial<NewApplicationItem> = {};
  if (existing.title !== fresh.title) set.title = fresh.title;
  if (existing.description !== fresh.description) set.description = fresh.description;
  if (existing.kind !== fresh.kind) set.kind = fresh.kind;
  if (existing.source !== fresh.source) set.source = fresh.source;
  // A student-corrected due date survives a sync, like their status and notes.
  if (!existing.studentEdited && existing.dueDate !== fresh.dueDate) set.dueDate = fresh.dueDate;
  if (existing.importance !== fresh.importance) set.importance = fresh.importance;
  if (existing.effort !== fresh.effort) set.effort = fresh.effort;
  if (existing.dependsOnOthers !== fresh.dependsOnOthers) set.dependsOnOthers = fresh.dependsOnOthers;
  if (existing.blocking !== fresh.blocking) set.blocking = fresh.blocking;
  if (!evidenceEqual(existing.evidence, fresh.evidence)) set.evidence = fresh.evidence;
  if (existing.status !== resolvedStatus) set.status = resolvedStatus;

  if (Object.keys(set).length === 0) return null;

  const transitionedToDone = existing.status !== 'done' && resolvedStatus === 'done';
  const transitionedAwayFromDone = existing.status === 'done' && resolvedStatus !== 'done';
  if (transitionedToDone) set.completedAt = new Date();
  else if (transitionedAwayFromDone) set.completedAt = null;

  set.lastCheckedAt = new Date();
  return set;
}

/**
 * Diffs `previous` (the stored rows for one scope) against `next` (the freshly built checklist
 * for the same scope). `applicationId` is the scope being reconciled — `null` for the student-wide
 * items — and is used to defensively re-scope `previous` in case a caller passed a wider set.
 */
export function reconcile(previous: ApplicationItem[], next: ChecklistItemSpec[], applicationId: string | null): ReconcileResult {
  const scoped = previous.filter((row) => row.applicationId === applicationId);
  // Custom, student-authored items are never matched, updated, or deleted by the rule engine.
  const ruleRows = scoped.filter((row) => row.source !== 'student');
  const byRuleKey = new Map(ruleRows.map((row) => [row.ruleKey, row]));
  const matchedIds = new Set<string>();

  const toInsert: ChecklistItemSpec[] = [];
  const toUpdate: Array<{ id: string; set: Partial<NewApplicationItem> }> = [];

  for (const item of next) {
    const existing = byRuleKey.get(item.ruleKey);
    if (!existing) {
      toInsert.push(item);
      continue;
    }
    matchedIds.add(existing.id);
    const set = buildUpdate(existing, item);
    if (set) toUpdate.push({ id: existing.id, set });
  }

  const toDelete = ruleRows.filter((row) => !matchedIds.has(row.id) && !row.studentEdited).map((row) => row.id);

  return { toInsert, toUpdate, toDelete };
}
