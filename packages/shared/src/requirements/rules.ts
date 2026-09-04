/**
 * Generic rules that apply beyond what a Common App sync can show directly: FAFSA, score-send
 * lead time, recommender-ask lead time, transcript requests, CSS Profile timing, and the simple
 * applicability checks (fee waiver, mid-year report, interview, portfolio). Every rule here is a
 * pure function of its inputs so it can be unit-tested without a database or a clock.
 */
import type { z } from 'zod';
import { addDays } from '../time/dates';
import type { ApplicationStatus, InterviewPolicy, TestOptionalStance, TestPolicy } from '../domain/enums';
import type { IsoDate } from '../schemas/common';
import type {
  CssProfileRequirement as CssProfileRequirementSchema,
  PortfolioRequirement as PortfolioRequirementSchema,
  SchoolRequirementsData,
} from '../schemas/requirements';

// These two have no companion `z.infer` type export from the schemas package.
type CssProfileRequirement = z.infer<typeof CssProfileRequirementSchema>;
type PortfolioRequirement = z.infer<typeof PortfolioRequirementSchema>;

/** Lead times used to back-calculate "act by" dates from a hard deadline. All in calendar days. */
export const LEAD_TIMES = {
  /** SAT reports take ~1-2 weeks, ACT ~2 weeks; recommend sending 3 weeks out to be safe. */
  scoreSendDays: 21,
  /** Give a recommender at least 4 weeks to write and submit a letter. */
  recommenderAskDays: 28,
  /** Request a transcript send with enough runway for the school's own turnaround. */
  transcriptRequestDays: 14,
} as const;

/** FAFSA opens on this date every cycle; nothing can be filed before it. */
export const FAFSA_OPENS: IsoDate = '2026-10-01';

/** Fallback FAFSA due date when no school on the list has an earlier priority deadline. */
export const FAFSA_FALLBACK_DEADLINE: IsoDate = '2027-06-30';

/** Common App mid-year report window: colleges expect it once fall semester grades post. */
export const MIDYEAR_REPORT_DUE: IsoDate = '2027-02-15';

/**
 * When to send official test scores, given a school's deadline. `LEAD_TIMES.scoreSendDays`
 * before the deadline, so a score report has time to arrive and be matched to the application.
 */
export function scoreSendDueDate(deadline: IsoDate): IsoDate {
  return addDays(deadline, -LEAD_TIMES.scoreSendDays);
}

/**
 * Whether a score-send item is warranted at all. A test-blind school never wants scores (callers
 * still surface the item, marked not_applicable, so the student knows not to bother). A
 * test-required school always wants them. Otherwise only when the student plans to submit scores
 * and actually has one.
 */
export function shouldIncludeScoreSend(
  testPolicy: TestPolicy,
  stance: TestOptionalStance,
  hasSatOrAct: boolean,
): boolean {
  if (testPolicy === 'blind') return true;
  if (testPolicy === 'required') return true;
  return (stance === 'submit_all' || stance === 'submit_selectively') && hasSatOrAct;
}

/** When to ask a recommender: `LEAD_TIMES.recommenderAskDays` before the deadline. */
export function recommenderAskDueDate(deadline: IsoDate): IsoDate {
  return addDays(deadline, -LEAD_TIMES.recommenderAskDays);
}

/** When to request the transcript send: `LEAD_TIMES.transcriptRequestDays` before the deadline. */
export function transcriptDueDate(deadline: IsoDate): IsoDate {
  return addDays(deadline, -LEAD_TIMES.transcriptRequestDays);
}

/** Whether the student should be offered a fee-waiver item for this school. */
export function feeWaiverApplicable(
  financialConstraints: boolean | null,
  requirements: Pick<SchoolRequirementsData, 'fee_waiver_eligible'>,
): boolean {
  return financialConstraints === true && requirements.fee_waiver_eligible;
}

/** Whether a mid-year report item is still relevant (moot once a decision has come back). */
export function midyearApplicable(requiresMidyear: boolean, status: ApplicationStatus): boolean {
  return requiresMidyear && status !== 'decision_received';
}

/** Whether an interview item should be surfaced at all. */
export function interviewApplicable(policy: InterviewPolicy): boolean {
  return policy !== 'none';
}

/** Whether a portfolio item should be surfaced at all. */
export function portfolioApplicable(status: PortfolioRequirement['status']): boolean {
  return status !== 'none';
}

/** The date the CSS Profile is due for one application: the school's own date, if known. */
export function cssProfileDueDate(requirement: CssProfileRequirement, fallbackDeadline: IsoDate): IsoDate {
  return requirement.deadline ?? fallbackDeadline;
}

/**
 * FAFSA due date across a student's whole list: the earliest school priority deadline they have,
 * clamped to not fall before FAFSA actually opens, or the fallback if no school has a priority
 * date at all.
 */
export function fafsaDueDate(earliestPriorityDeadline: IsoDate | null): IsoDate {
  if (!earliestPriorityDeadline) return FAFSA_FALLBACK_DEADLINE;
  return earliestPriorityDeadline < FAFSA_OPENS ? FAFSA_OPENS : earliestPriorityDeadline;
}
