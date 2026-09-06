import type { ApplicationItemDto } from '@apogee/shared/api';
import type { CompletionGroup } from '@/components/system';
import { CHECKLIST_GROUP_NAMES, checklistGroupForKind } from './checklist-groups';

/**
 * One application's items bucketed into the six checklist groups' done/total counts, for
 * `CompletionBar`. `not_applicable` items are excluded from both the numerator and the
 * denominator — they're neither outstanding work nor completed work. Every group name always
 * appears, even at zero total, so a school with nothing yet in a group still reports a stable
 * (empty) segment rather than an undefined one.
 */
export function completionGroups(items: ApplicationItemDto[]): CompletionGroup[] {
  const groups = CHECKLIST_GROUP_NAMES.map((label) => ({ label, done: 0, total: 0 }));
  const byLabel = new Map(groups.map((group) => [group.label, group]));
  for (const item of items) {
    if (item.status === 'not_applicable') continue;
    // checklistGroupForKind is exhaustive over ItemKind, so this lookup can never miss.
    const group = byLabel.get(checklistGroupForKind(item.kind))!;
    group.total += 1;
    if (item.status === 'done') group.done += 1;
  }
  return groups;
}

/** Splits a flat, multi-school item list (as `itemsList` returns with no filter) into one
 * `completionGroups` result per `application_id`. Items with no application (dangling custom
 * items, if any) are skipped — there is no row for them to size a bar for. */
export function completionByApplication(items: ApplicationItemDto[]): Record<string, CompletionGroup[]> {
  const byApplication = new Map<string, ApplicationItemDto[]>();
  for (const item of items) {
    if (!item.application_id) continue;
    const list = byApplication.get(item.application_id);
    if (list) list.push(item);
    else byApplication.set(item.application_id, [item]);
  }
  const result: Record<string, CompletionGroup[]> = {};
  for (const [applicationId, appItems] of byApplication) {
    result[applicationId] = completionGroups(appItems);
  }
  return result;
}
