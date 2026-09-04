/** Requirements engine: the school dataset, checklist builder, reconciliation, and search. */
export type {
  ChecklistApplication,
  ChecklistInput,
  ChecklistItemSpec,
  ChecklistStudent,
  SchoolDatasetEntry,
  StudentWideChecklistInput,
} from './types';

export { FLAGSHIPS, IVY_PLUS, LACS, ROLLING_SAFETIES, SCHOOL_BY_SLUG, SCHOOL_DATASET, TOP_PRIVATES } from './dataset';

export {
  applicationCommonAppUrl,
  buildChecklist,
  buildStudentWideChecklist,
  resolveDeadline,
  supplementsForPlan,
} from './checklist';

export {
  cssProfileDueDate,
  fafsaDueDate,
  FAFSA_FALLBACK_DEADLINE,
  FAFSA_OPENS,
  feeWaiverApplicable,
  interviewApplicable,
  LEAD_TIMES,
  MIDYEAR_REPORT_DUE,
  midyearApplicable,
  portfolioApplicable,
  recommenderAskDueDate,
  scoreSendDueDate,
  shouldIncludeScoreSend,
  transcriptDueDate,
} from './rules';

export type { ReconcileResult } from './reconcile';
export { reconcile } from './reconcile';

export { findSchool, findSchools, planConflicts } from './search';
