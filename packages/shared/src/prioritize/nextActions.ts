import type { NudgeIntensity } from '../domain/enums';
import type { IsoDate } from '../schemas/common';
import { calendarDaysBetween, effectiveDueDate, scoreItem } from './score';
import type { NextActionSpec, PrioritizeApplication, PrioritizeInput, PrioritizeItem } from './types';

/** Item statuses that still need student (or third-party) action. */
export const OPEN_ITEM_STATUSES = new Set<PrioritizeItem['status']>(['missing', 'in_progress', 'blocked']);

/** Application statuses past which its items no longer need next actions. */
const CLOSED_APPLICATION_STATUSES = new Set<PrioritizeApplication['status']>(['submitted', 'decision_received']);

const PLAN_LABELS: Record<PrioritizeApplication['plan'], string> = {
  ED: 'ED',
  ED2: 'ED2',
  EA: 'EA',
  REA: 'REA',
  RD: 'RD',
  rolling: 'rolling admission',
};

function dueClause(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'no deadline is on file yet';
  if (daysRemaining < 0) {
    const overdue = -daysRemaining;
    return `it was due ${overdue} day${overdue === 1 ? '' : 's'} ago`;
  }
  if (daysRemaining === 0) return 'it is due today';
  return `it is due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
}

function schoolAndPlan(application: PrioritizeApplication | null, item: PrioritizeItem): string | null {
  const school = application?.schoolName ?? item.schoolName;
  if (!school) return null;
  return application ? `${school} ${PLAN_LABELS[application.plan]}` : school;
}

/** An imperative sentence telling the student exactly what to do next. */
function describeAction(item: PrioritizeItem, application: PrioritizeApplication | null): string {
  const school = application?.schoolName ?? item.schoolName;
  const forSchool = school ? ` for ${school}` : '';
  const evidenceSuffix = item.evidenceText ? ` (${item.evidenceText})` : '';

  switch (item.kind) {
    case 'supplement_essay':
    case 'personal_essay':
      return `Finish the ${item.title} essay${evidenceSuffix}`;
    case 'teacher_rec':
    case 'counselor_rec':
    case 'other_rec':
      return `Follow up on the ${item.title} recommendation${forSchool}${evidenceSuffix}`;
    case 'ferpa':
      return `Sign the FERPA release${forSchool}`;
    case 'test_scores':
    case 'score_send':
      return `Send test scores${forSchool}`;
    case 'transcript':
      return `Request your transcript be sent${forSchool}`;
    case 'midyear_report':
      return `Request your midyear report be sent${forSchool}`;
    case 'school_report':
      return `Request your school report be sent${forSchool}`;
    case 'application_fee':
      return `Pay the application fee${forSchool}`;
    case 'fee_waiver':
      return `Submit the fee waiver request${forSchool}`;
    case 'fafsa':
      return 'Finish the FAFSA';
    case 'css_profile':
      return 'Finish the CSS Profile';
    case 'interview':
      return `Schedule the interview${forSchool}`;
    case 'portfolio':
      return `Finish the portfolio${forSchool}${evidenceSuffix}`;
    case 'review_submit':
      return `Review and get ready to submit${school ? ` the ${school} application` : ' the application'}`;
    case 'common_app_section':
    case 'college_questions':
    case 'custom':
      return `Finish "${item.title}"${forSchool}${evidenceSuffix}`;
  }
}

/** One concrete sentence with real facts: what, where, and when. */
function describeReason(item: PrioritizeItem, application: PrioritizeApplication | null, daysRemaining: number | null): string {
  const where = schoolAndPlan(application, item);
  const subject = where ? `${where}: ${item.title}` : item.title;
  const dependencyClause = item.dependsOnOthers ? ', and it depends on someone else acting first' : '';
  const evidenceClause = item.evidenceText ? ` (${item.evidenceText})` : '';
  return `${subject}${evidenceClause} — ${dueClause(daysRemaining)}${dependencyClause}.`;
}

interface RankedCandidate {
  spec: NextActionSpec;
  title: string;
}

function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (b.spec.priorityScore !== a.spec.priorityScore) return b.spec.priorityScore - a.spec.priorityScore;
  const ad = a.spec.dueDate;
  const bd = b.spec.dueDate;
  if (ad !== bd) {
    if (ad === null) return 1;
    if (bd === null) return -1;
    return ad < bd ? -1 : 1;
  }
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return 0;
}

/**
 * Score and rank every open item into a `next_actions` upsert list: one action per item, sorted
 * by score (deadline ties broken by due date, then title), ranked 1..n. Only items still needing
 * action, on applications still in progress, are considered.
 */
export function computeNextActions(input: PrioritizeInput): NextActionSpec[] {
  const applicationsById = new Map(input.applications.map((a) => [a.id, a] as const));

  const eligible = input.items.filter((item) => {
    if (!OPEN_ITEM_STATUSES.has(item.status)) return false;
    if (item.applicationId === null) return true;
    const application = applicationsById.get(item.applicationId);
    if (application && CLOSED_APPLICATION_STATUSES.has(application.status)) return false;
    return true;
  });

  const candidates: RankedCandidate[] = eligible.map((item) => {
    const application = item.applicationId ? (applicationsById.get(item.applicationId) ?? null) : null;
    const dueDate: IsoDate | null = effectiveDueDate(item, application);
    const daysRemaining = dueDate === null ? null : calendarDaysBetween(input.today, dueDate);
    const { score } = scoreItem(item, application, input.today);

    return {
      title: item.title,
      spec: {
        applicationItemId: item.id,
        applicationId: item.applicationId,
        action: describeAction(item, application),
        reason: describeReason(item, application, daysRemaining),
        priorityScore: score,
        rank: 0,
        dueDate,
        daysRemaining,
      },
    };
  });

  candidates.sort(compareCandidates);

  return candidates.map((c, i) => ({ ...c.spec, rank: i + 1 }));
}

const SEND_CAPS: Record<NudgeIntensity, number> = { chill: 1, normal: 3, intense: 6 };

/** How many proactive messages per day this intensity setting allows. */
export function sendCap(intensity: NudgeIntensity): number {
  return SEND_CAPS[intensity];
}

/** The highest-ranked actions worth sending today at this intensity. */
export function topForIntensity(actions: NextActionSpec[], intensity: NudgeIntensity): NextActionSpec[] {
  return actions.slice(0, sendCap(intensity));
}
