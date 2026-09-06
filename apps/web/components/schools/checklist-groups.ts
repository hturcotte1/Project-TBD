import type { ApplicationItemDto } from '@apogee/shared/api';
import type { ItemKind } from '@apogee/shared/domain';

export const CHECKLIST_GROUP_NAMES = [
  'Common App sections',
  'College questions and supplements',
  'Recommendations',
  'Tests and scores',
  'Financial aid and fees',
  'Custom',
] as const;

export type ChecklistGroupName = (typeof CHECKLIST_GROUP_NAMES)[number];

/**
 * Every `ItemKind` maps to exactly one of the six groups the school detail page always shows, in
 * this fixed order. Kinds are grouped by *who acts on them* rather than a literal reading of the
 * group label, so the page reads as "your Common App account", "what you write for this school",
 * "people who write for you", "scores", "money", and "everything else" (including anything the
 * student added by hand):
 *  - Common App sections: the account-wide sections plus the record-keeping steps tied to the
 *    Common App process itself (transcript, mid-year/school report, final review).
 *  - College questions and supplements: everything the student writes or submits as content for
 *    this specific school (including the personal essay and a portfolio).
 *  - Recommendations: recommenders and the FERPA release that unlocks them.
 *  - Tests and scores: score reporting.
 *  - Financial aid and fees: money.
 *  - Custom: items the student added themselves, plus anything with no cleaner home (interview).
 * A `satisfies`-style exhaustiveness check below fails to compile if `ItemKind` ever grows a case
 * this map doesn't cover.
 */
const KIND_TO_GROUP: Record<ItemKind, ChecklistGroupName> = {
  common_app_section: 'Common App sections',
  transcript: 'Common App sections',
  midyear_report: 'Common App sections',
  school_report: 'Common App sections',
  review_submit: 'Common App sections',

  college_questions: 'College questions and supplements',
  supplement_essay: 'College questions and supplements',
  personal_essay: 'College questions and supplements',
  portfolio: 'College questions and supplements',

  teacher_rec: 'Recommendations',
  counselor_rec: 'Recommendations',
  other_rec: 'Recommendations',
  ferpa: 'Recommendations',

  test_scores: 'Tests and scores',
  score_send: 'Tests and scores',

  fafsa: 'Financial aid and fees',
  css_profile: 'Financial aid and fees',
  application_fee: 'Financial aid and fees',
  fee_waiver: 'Financial aid and fees',

  interview: 'Custom',
  custom: 'Custom',
};

export function checklistGroupForKind(kind: ItemKind): ChecklistGroupName {
  return KIND_TO_GROUP[kind];
}

export type ChecklistGroups = Record<ChecklistGroupName, ApplicationItemDto[]>;

/** Buckets a flat item list into the six fixed groups, in display order, each internally sorted by importance (desc) then title. */
export function groupChecklistItems(items: ApplicationItemDto[]): ChecklistGroups {
  const groups = Object.fromEntries(CHECKLIST_GROUP_NAMES.map((name) => [name, [] as ApplicationItemDto[]])) as ChecklistGroups;
  for (const item of items) {
    groups[checklistGroupForKind(item.kind)].push(item);
  }
  for (const name of CHECKLIST_GROUP_NAMES) {
    groups[name].sort((a, b) => b.importance - a.importance || a.title.localeCompare(b.title));
  }
  return groups;
}
