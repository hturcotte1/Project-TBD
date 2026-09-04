/**
 * Turns a school's requirements plus the latest Common App snapshot into a deterministic list of
 * checklist items. Every `build*` function here is pure: same input, same output, same order,
 * every time — `reconcile.ts` depends on that to diff against what is already stored.
 */
import { format, parseISO } from 'date-fns';
import type { z } from 'zod';
import type { ApplicationPlan, InterviewPolicy } from '../domain/enums';
import type {
  CommonAppSections as CommonAppSectionsSchema,
  CommonAppSnapshot,
  RecommenderEntry,
  SectionStatus,
  SupplementEntry,
} from '../schemas/snapshot';
import type { IsoDate } from '../schemas/common';
import type { ItemEvidence } from '../schemas/items';
import type {
  CssProfileRequirement as CssProfileRequirementSchema,
  PortfolioRequirement as PortfolioRequirementSchema,
  SchoolRequirementsData,
  SupplementPrompt,
} from '../schemas/requirements';

// These three have no companion `z.infer` type export from the schemas package.
type CommonAppSections = z.infer<typeof CommonAppSectionsSchema>;
type CssProfileRequirement = z.infer<typeof CssProfileRequirementSchema>;
type PortfolioRequirement = z.infer<typeof PortfolioRequirementSchema>;
import {
  cssProfileDueDate,
  fafsaDueDate,
  feeWaiverApplicable,
  FAFSA_OPENS,
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
import type { ChecklistInput, ChecklistItemSpec, StudentWideChecklistInput } from './types';

// ---------- small shared helpers ----------

function formatShort(date: IsoDate): string {
  return format(parseISO(date), 'MMM d');
}

function evidence(capturedAt: string | null, text: string, confidence: number): ItemEvidence | null {
  if (!capturedAt) return null;
  return { seen_at: capturedAt, text: text.slice(0, 500), confidence, source_url: null };
}

function mapSectionStatus(status: SectionStatus): ChecklistItemSpec['status'] {
  switch (status) {
    case 'complete':
      return 'done';
    case 'in_progress':
      return 'in_progress';
    case 'not_started':
    case 'unknown':
      return 'missing';
  }
}

function sectionConfidence(status: SectionStatus): number {
  switch (status) {
    case 'complete':
    case 'not_started':
      return 0.9;
    case 'in_progress':
      return 0.75;
    case 'unknown':
      return 0.3;
  }
}

const RECOMMENDER_STATUS_RANK: Record<RecommenderEntry['status'], number> = {
  submitted: 0,
  invited: 1,
  not_invited: 2,
  declined: 3,
  unknown: 4,
};

function recommenderStatusToItemStatus(status: RecommenderEntry['status']): ChecklistItemSpec['status'] {
  switch (status) {
    case 'submitted':
      return 'done';
    case 'invited':
      return 'in_progress';
    case 'declined':
      return 'blocked';
    case 'not_invited':
    case 'unknown':
      return 'missing';
  }
}

function recommenderConfidence(status: RecommenderEntry['status']): number {
  switch (status) {
    case 'submitted':
    case 'declined':
      return 0.9;
    case 'invited':
      return 0.8;
    case 'not_invited':
      return 0.7;
    case 'unknown':
      return 0.3;
  }
}

function recommenderText(entry: RecommenderEntry): string {
  switch (entry.status) {
    case 'submitted':
      return `${entry.name} — submitted${entry.submitted_at ? ` ${formatShort(entry.submitted_at)}` : ''}`;
    case 'invited':
      return `${entry.name} — invited${entry.invited_at ? ` ${formatShort(entry.invited_at)}` : ''}, not submitted`;
    case 'declined':
      return `${entry.name} — declined`;
    case 'not_invited':
      return `${entry.name} — not yet invited`;
    case 'unknown':
      return `${entry.name} — status unknown`;
  }
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// ---------- per-application rules ----------

/** The deadline for one plan at one school, and whether that date should be trusted as-is. */
export function resolveDeadline(
  requirements: SchoolRequirementsData,
  plan: ApplicationPlan,
): { deadline: IsoDate; needsVerification: boolean } | null {
  const planReq = requirements.plans.find((p) => p.plan === plan);
  if (!planReq) return null;
  return { deadline: planReq.deadline, needsVerification: planReq.needs_verification || requirements.needs_verification };
}

/** Supplement prompts that apply to the given plan (a prompt with `applies_to_plans: null` applies to all). */
export function supplementsForPlan(requirements: SchoolRequirementsData, plan: ApplicationPlan): SupplementPrompt[] {
  return requirements.supplements.filter((s) => s.applies_to_plans === null || s.applies_to_plans.includes(plan));
}

/** A link back into the Common App portal for one school, for use in messages and the dashboard. */
export function applicationCommonAppUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${slug}`;
}

function questionsItem(input: ChecklistInput): ChecklistItemSpec | null {
  if (!input.application.commonAppMember) return null;
  const status = input.snapshotCollege?.questions_status ?? 'unknown';
  return {
    ruleKey: 'questions',
    kind: 'college_questions',
    title: 'College-specific questions',
    description: `Answer ${input.application.schoolName}'s Common App college questions (major, housing, application details).`,
    source: 'common_app',
    status: mapSectionStatus(status),
    evidence: evidence(input.capturedAt, `Questions section: ${status.replace('_', ' ')}`, sectionConfidence(status)),
    dueDate: input.application.deadline,
    importance: 85,
    effort: 'small',
    dependsOnOthers: false,
    blocking: false,
  };
}

function supplementItems(input: ChecklistInput): ChecklistItemSpec[] {
  if (!input.application.commonAppMember) return [];
  const prompts = supplementsForPlan(input.requirements, input.application.plan);
  return prompts.map((prompt): ChecklistItemSpec => {
    const match: SupplementEntry | undefined = input.snapshotCollege?.supplements.find(
      (s) => normalizeTitle(s.title) === normalizeTitle(prompt.title),
    );
    const status: SectionStatus = match?.status ?? 'unknown';
    const text = match
      ? `${match.word_count ?? 0} words — ${status.replace('_', ' ')}`
      : 'Not yet visible on Common App';
    return {
      ruleKey: `supplement:${prompt.id}`,
      kind: 'supplement_essay',
      title: prompt.title,
      description: prompt.word_limit ? `${prompt.title} (${prompt.word_limit} words max).` : prompt.title,
      source: 'common_app',
      status: mapSectionStatus(status),
      evidence: evidence(input.capturedAt, text, sectionConfidence(status)),
      dueDate: input.application.deadline,
      importance: prompt.required ? 90 : 40,
      effort: 'large',
      dependsOnOthers: false,
      blocking: prompt.required,
    };
  });
}

function teacherRecItems(input: ChecklistInput): ChecklistItemSpec[] {
  if (!input.application.commonAppMember) return [];
  const { teacher_min: min, teacher_max: max } = input.requirements.recommendations;
  const teachers = [...(input.snapshotCollege?.teachers ?? [])].sort(
    (a, b) => RECOMMENDER_STATUS_RANK[a.status] - RECOMMENDER_STATUS_RANK[b.status],
  );
  // One slot per required letter, plus one per teacher the student has actually invited beyond
  // the minimum (capped at the school's max), so an optional second letter is still tracked.
  const cap = Math.max(min, max);
  const slotCount = Math.min(cap, Math.max(min, teachers.length, min === 0 && max > 0 ? 1 : 0));
  if (slotCount === 0) return [];
  const items: ChecklistItemSpec[] = [];
  for (let i = 0; i < slotCount; i++) {
    const teacher = teachers[i];
    const status = teacher?.status ?? 'not_invited';
    const required = i < min;
    items.push({
      ruleKey: `teacher_rec:${i + 1}`,
      kind: 'teacher_rec',
      title: required ? `Teacher recommendation ${i + 1}` : `Teacher recommendation ${i + 1} (optional)`,
      description: `Invite a teacher and confirm they submit a recommendation for ${input.application.schoolName}.`,
      source: 'common_app',
      status: recommenderStatusToItemStatus(status),
      evidence: teacher ? evidence(input.capturedAt, recommenderText(teacher), recommenderConfidence(status)) : null,
      dueDate: recommenderAskDueDate(input.application.deadline),
      importance: required ? 80 : 40,
      effort: 'medium',
      dependsOnOthers: true,
      blocking: false,
    });
  }
  return items;
}

function counselorRecItem(input: ChecklistInput): ChecklistItemSpec | null {
  if (!input.application.commonAppMember) return null;
  const required = input.requirements.recommendations.counselor_required;
  const counselor = input.snapshotCollege?.counselor ?? null;
  const status = counselor?.status ?? 'not_invited';
  return {
    ruleKey: 'counselor_rec',
    kind: 'counselor_rec',
    title: 'Counselor recommendation',
    description: `Your counselor submits the school report and counselor recommendation for ${input.application.schoolName}.`,
    source: 'common_app',
    status: recommenderStatusToItemStatus(status),
    evidence: counselor ? evidence(input.capturedAt, recommenderText(counselor), recommenderConfidence(status)) : null,
    dueDate: recommenderAskDueDate(input.application.deadline),
    importance: required ? 85 : 40,
    effort: 'medium',
    dependsOnOthers: true,
    blocking: false,
  };
}

function ferpaItem(input: ChecklistInput): ChecklistItemSpec | null {
  if (!input.application.commonAppMember) return null;
  const status = input.snapshotCollege?.ferpa_status ?? 'unknown';
  const text =
    status === 'complete'
      ? 'FERPA release complete'
      : status === 'incomplete'
        ? 'FERPA release not yet completed'
        : 'FERPA status unknown';
  return {
    ruleKey: 'ferpa',
    kind: 'ferpa',
    title: 'FERPA release',
    description: 'Sign the FERPA waiver so recommenders can be invited and your counselor can submit the school report.',
    source: 'common_app',
    status: status === 'complete' ? 'done' : 'missing',
    evidence: evidence(input.capturedAt, text, status === 'unknown' ? 0.3 : 0.9),
    dueDate: input.application.deadline,
    importance: 90,
    effort: 'small',
    dependsOnOthers: false,
    blocking: true,
  };
}

function reviewSubmitItem(input: ChecklistInput): ChecklistItemSpec | null {
  if (!input.application.commonAppMember) return null;
  const snap = input.snapshotCollege;
  const status: ChecklistItemSpec['status'] =
    snap?.submission_status === 'submitted' ? 'done' : snap?.review_submit_status === 'ready' ? 'in_progress' : 'missing';
  const text = snap
    ? snap.submission_status === 'submitted'
      ? `Submitted${snap.submitted_at ? ` ${formatShort(snap.submitted_at)}` : ''}`
      : `Review & submit: ${snap.review_submit_status.replace('_', ' ')}`
    : 'Not yet visible on Common App';
  return {
    ruleKey: 'review_submit',
    kind: 'review_submit',
    title: 'Review and submit',
    description: `Do a final review of every section for ${input.application.schoolName}, then submit.`,
    source: 'common_app',
    status,
    evidence: evidence(input.capturedAt, text, snap ? 0.9 : 0.3),
    dueDate: input.application.deadline,
    importance: 100,
    effort: 'medium',
    dependsOnOthers: false,
    blocking: true,
  };
}

function transcriptItem(input: ChecklistInput): ChecklistItemSpec {
  const via = input.application.commonAppMember ? 'through Common App' : "through the school's own application portal";
  return {
    ruleKey: 'transcript',
    kind: 'transcript',
    title: 'Request transcript',
    description: `Ask your counselor's office to send your official transcript to ${input.application.schoolName} ${via}.`,
    source: 'internal_rule',
    status: 'missing',
    evidence: null,
    dueDate: transcriptDueDate(input.application.deadline),
    importance: 70,
    effort: 'small',
    dependsOnOthers: true,
    blocking: false,
  };
}

function scoreSendItem(input: ChecklistInput): ChecklistItemSpec | null {
  const policy = input.requirements.test_policy;
  if (!shouldIncludeScoreSend(policy, input.student.testStance, input.student.hasSatOrAct)) return null;
  const blind = policy === 'blind';
  return {
    ruleKey: 'score_send',
    kind: 'score_send',
    title: 'Send official test scores',
    description: blind
      ? `${input.application.schoolName} does not consider standardized test scores — no need to send any.`
      : `Send official SAT/ACT scores to ${input.application.schoolName}. Score reports take one to two weeks to arrive, so send at least ${LEAD_TIMES.scoreSendDays} days before the deadline.`,
    source: 'internal_rule',
    status: blind ? 'not_applicable' : 'missing',
    evidence: null,
    dueDate: blind ? null : scoreSendDueDate(input.application.deadline),
    importance: policy === 'required' ? 85 : 50,
    effort: 'medium',
    dependsOnOthers: true,
    blocking: false,
  };
}

function applicationFeeItem(input: ChecklistInput): ChecklistItemSpec {
  const fee = input.requirements.application_fee;
  const feeStatus = input.snapshotCollege?.fee_status ?? 'unknown';
  const status: ChecklistItemSpec['status'] =
    fee === 0 || feeStatus === 'not_required'
      ? 'not_applicable'
      : feeStatus === 'paid' || feeStatus === 'waived'
        ? 'done'
        : 'missing';
  return {
    ruleKey: 'application_fee',
    kind: 'application_fee',
    title: 'Pay the application fee',
    description:
      fee != null
        ? `Application fee is $${fee}${input.application.commonAppMember ? ' on Common App' : ''}.`
        : `Confirm the application fee amount on ${input.application.schoolName}'s portal.`,
    source: input.application.commonAppMember ? 'common_app' : 'internal_rule',
    status,
    evidence: input.snapshotCollege
      ? evidence(input.capturedAt, `Fee status: ${feeStatus}`, feeStatus === 'unknown' ? 0.3 : 0.9)
      : null,
    dueDate: input.application.deadline,
    importance: 80,
    effort: 'small',
    dependsOnOthers: false,
    blocking: false,
  };
}

function feeWaiverItem(input: ChecklistInput): ChecklistItemSpec | null {
  if (!feeWaiverApplicable(input.student.financialConstraints, input.requirements)) return null;
  const feeStatus = input.snapshotCollege?.fee_status ?? 'unknown';
  return {
    ruleKey: 'fee_waiver',
    kind: 'fee_waiver',
    title: 'Request a fee waiver',
    description: `You qualify for a fee waiver at ${input.application.schoolName} — request it instead of paying the application fee.`,
    source: 'internal_rule',
    status: feeStatus === 'waived' ? 'done' : 'missing',
    evidence: null,
    dueDate: input.application.deadline,
    importance: 55,
    effort: 'small',
    dependsOnOthers: false,
    blocking: false,
  };
}

function cssProfileItem(input: ChecklistInput): ChecklistItemSpec | null {
  const req: CssProfileRequirement = input.requirements.css_profile;
  if (!req.required) return null;
  return {
    ruleKey: 'css_profile',
    kind: 'css_profile',
    title: 'Submit the CSS Profile',
    description: `${input.application.schoolName} requires the CSS Profile for financial aid consideration.`,
    source: 'internal_rule',
    status: 'missing',
    evidence: null,
    dueDate: cssProfileDueDate(req, input.application.deadline),
    importance: 85,
    effort: 'large',
    dependsOnOthers: false,
    blocking: false,
  };
}

function midyearReportItem(input: ChecklistInput): ChecklistItemSpec | null {
  if (!midyearApplicable(input.requirements.midyear_report, input.application.status)) return null;
  return {
    ruleKey: 'midyear_report',
    kind: 'midyear_report',
    title: 'Mid-year report',
    description: `Your counselor sends a mid-year report with fall semester grades to ${input.application.schoolName} once they are available.`,
    source: 'internal_rule',
    status: 'missing',
    evidence: null,
    dueDate: MIDYEAR_REPORT_DUE,
    importance: 55,
    effort: 'small',
    dependsOnOthers: true,
    blocking: false,
  };
}

function interviewDescription(policy: InterviewPolicy, schoolName: string): string {
  switch (policy) {
    case 'required':
      return `${schoolName} requires an interview. Sign up as soon as it is offered.`;
    case 'by_invitation':
      return `${schoolName} interviews by invitation only — watch email for an invite and respond promptly.`;
    case 'recommended':
      return `${schoolName} recommends an interview. It is optional but strengthens the application.`;
    case 'optional':
      return `${schoolName} offers an optional interview.`;
    case 'none':
      return '';
  }
}

function interviewItem(input: ChecklistInput): ChecklistItemSpec | null {
  const policy = input.requirements.interview_policy;
  if (!interviewApplicable(policy)) return null;
  const weighty = policy === 'required' || policy === 'by_invitation';
  return {
    ruleKey: 'interview',
    kind: 'interview',
    title: 'Interview',
    description: interviewDescription(policy, input.application.schoolName),
    source: 'internal_rule',
    status: 'missing',
    evidence: null,
    dueDate: input.application.deadline,
    importance: weighty ? 80 : 40,
    effort: 'medium',
    dependsOnOthers: true,
    blocking: false,
  };
}

function portfolioItem(input: ChecklistInput): ChecklistItemSpec | null {
  const req: PortfolioRequirement = input.requirements.portfolio;
  if (!portfolioApplicable(req.status)) return null;
  const required = req.status === 'required' || req.status === 'required_for_majors';
  return {
    ruleKey: 'portfolio',
    kind: 'portfolio',
    title: 'Portfolio submission',
    description:
      req.description ||
      `Submit a portfolio for ${input.application.schoolName}${req.status === 'required_for_majors' ? ' (required for certain majors)' : ''}.`,
    source: 'internal_rule',
    status: 'missing',
    evidence: null,
    dueDate: input.application.deadline,
    importance: required ? 85 : 45,
    effort: 'large',
    dependsOnOthers: false,
    blocking: false,
  };
}

/** Builds every checklist item for one application, in a fixed, deterministic order. */
export function buildChecklist(input: ChecklistInput): ChecklistItemSpec[] {
  const items: ChecklistItemSpec[] = [];
  const questions = questionsItem(input);
  if (questions) items.push(questions);
  items.push(...supplementItems(input));
  items.push(...teacherRecItems(input));
  const counselor = counselorRecItem(input);
  if (counselor) items.push(counselor);
  const ferpa = ferpaItem(input);
  if (ferpa) items.push(ferpa);
  items.push(transcriptItem(input));
  const scoreSend = scoreSendItem(input);
  if (scoreSend) items.push(scoreSend);
  items.push(applicationFeeItem(input));
  const feeWaiver = feeWaiverItem(input);
  if (feeWaiver) items.push(feeWaiver);
  const css = cssProfileItem(input);
  if (css) items.push(css);
  const midyear = midyearReportItem(input);
  if (midyear) items.push(midyear);
  const interview = interviewItem(input);
  if (interview) items.push(interview);
  const portfolio = portfolioItem(input);
  if (portfolio) items.push(portfolio);
  const reviewSubmit = reviewSubmitItem(input);
  if (reviewSubmit) items.push(reviewSubmit);
  return items;
}

// ---------- student-wide rules ----------

const SECTION_TITLES = {
  profile: 'Profile',
  family: 'Family',
  education: 'Education',
  testing: 'Testing',
  activities: 'Activities',
  courses_grades: 'Courses & Grades',
} as const;

type SectionKey = keyof typeof SECTION_TITLES;
const SECTION_KEYS: SectionKey[] = ['profile', 'family', 'education', 'testing', 'activities', 'courses_grades'];

function testingEvidenceText(status: SectionStatus, testing: CommonAppSnapshot['testing'] | null): string {
  const base = `Testing section: ${status.replace('_', ' ')}`;
  const selfReported = testing?.self_reported[0];
  return selfReported ? `${base} (${selfReported.test} ${selfReported.score} self-reported)` : base;
}

function sectionItem(key: SectionKey, sections: CommonAppSections, input: StudentWideChecklistInput): ChecklistItemSpec {
  const status = sections[key];
  const title = SECTION_TITLES[key];
  const text = key === 'testing' ? testingEvidenceText(status, input.testing) : `${title} section: ${status.replace('_', ' ')}`;
  return {
    ruleKey: `section:${key}`,
    kind: 'common_app_section',
    title,
    description: `Complete the ${title} section of your Common App profile.`,
    source: 'common_app',
    status: mapSectionStatus(status),
    evidence: evidence(input.capturedAt, text, sectionConfidence(status)),
    dueDate: null,
    importance: key === 'activities' || key === 'courses_grades' ? 75 : 60,
    effort: key === 'activities' || key === 'courses_grades' ? 'medium' : 'small',
    dependsOnOthers: false,
    blocking: false,
  };
}

function writingItem(sections: CommonAppSections, input: StudentWideChecklistInput): ChecklistItemSpec {
  const writing = sections.writing;
  const text = `Personal essay: ${writing.status.replace('_', ' ')}${writing.word_count != null ? ` (${writing.word_count} words)` : ''}`;
  return {
    ruleKey: 'writing:personal_essay',
    kind: 'personal_essay',
    title: 'Personal essay',
    description: 'Write the Common App personal essay (used across every school on your list).',
    source: 'common_app',
    status: mapSectionStatus(writing.status),
    evidence: evidence(input.capturedAt, text, sectionConfidence(writing.status)),
    dueDate: null,
    importance: 90,
    effort: 'large',
    dependsOnOthers: false,
    blocking: false,
  };
}

function fafsaItem(input: StudentWideChecklistInput): ChecklistItemSpec {
  const due = fafsaDueDate(input.earliestFafsaPriority);
  const cssNote =
    input.needsCss && input.earliestCssDeadline
      ? ` Some of your schools also require the CSS Profile (earliest ${input.earliestCssDeadline}) — that is tracked separately on each application.`
      : '';
  return {
    ruleKey: 'fafsa',
    kind: 'fafsa',
    title: 'File the FAFSA',
    description: `FAFSA opens ${FAFSA_OPENS}. File as soon as it opens — state and institutional priority deadlines vary by school, so don't wait for the latest one on your list.${cssNote}`,
    source: 'internal_rule',
    status: 'missing',
    evidence: null,
    dueDate: due,
    importance: 90,
    effort: 'medium',
    dependsOnOthers: false,
    blocking: false,
  };
}

/** Builds the student-level (not tied to one application) checklist items, in a fixed order. */
export function buildStudentWideChecklist(input: StudentWideChecklistInput): ChecklistItemSpec[] {
  const items: ChecklistItemSpec[] = [];
  const sections = input.sections;
  if (sections) {
    for (const key of SECTION_KEYS) items.push(sectionItem(key, sections, input));
    items.push(writingItem(sections, input));
  }
  items.push(fafsaItem(input));
  return items;
}
