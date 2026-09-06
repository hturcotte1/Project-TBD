import type { ApplicationPlan, DecisionOutcome, ItemStatus, SelfAssessment } from '@apogee/shared/domain';

export const PLAN_LABELS: Record<ApplicationPlan, string> = {
  ED: 'Early Decision',
  ED2: 'Early Decision II',
  EA: 'Early Action',
  REA: 'Restrictive Early Action',
  RD: 'Regular Decision',
  rolling: 'Rolling',
};

export const SELF_ASSESSMENT_LABELS: Record<SelfAssessment, string> = {
  reach: 'Reach',
  target: 'Target',
  safety: 'Safety',
};

export const DECISION_LABELS: Record<DecisionOutcome, string> = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  deferred: 'Deferred',
  waitlisted: 'Waitlisted',
  withdrawn: 'Withdrawn',
};

/** The word shown next to a checklist item when it's neither done (a checked box) nor missing (a
 * blank one) — those two statuses read from the checkbox alone and need no extra word. */
export const ITEM_STATUS_WORDS: Partial<Record<ItemStatus, string>> = {
  in_progress: 'In progress',
  blocked: 'Blocked',
  not_applicable: 'Not applicable',
};
