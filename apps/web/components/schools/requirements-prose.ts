import type { InterviewPolicy, TestPolicy } from '@apogee/shared/domain';
import type { RecommendationRequirements, SchoolRequirementsData, SupplementPrompt } from '@apogee/shared/schemas';
import { formatDate } from '@/lib/format';

const NUMBER_WORDS: Record<number, string> = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four' };

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "one supplemental essay" / "three supplemental essays". */
function countNoun(n: number, noun: string): string {
  return `${numberWord(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/** "a" / "a and b" / "a, b, and c" — an Oxford-comma list for two or more parts. */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/** "2026-27" -> "fall 2026", the way students actually talk about a cycle. */
function cycleToFallLabel(cycle: string): string {
  return `fall ${cycle.slice(0, 4)}`;
}

function essaysSentence(schoolName: string, supplements: SupplementPrompt[]): string | null {
  if (supplements.length === 0) return null;
  const required = supplements.filter((s) => s.required).length;
  const optional = supplements.length - required;
  if (optional === 0) return `${schoolName} asks for ${countNoun(required, 'supplemental essay')}.`;
  if (required === 0) return `${schoolName} offers ${countNoun(optional, 'optional supplemental essay')}.`;
  return `${schoolName} asks for ${countNoun(required, 'supplemental essay')} and offers ${countNoun(optional, 'optional one')}.`;
}

function recommendationsSentence(schoolName: string, recs: RecommendationRequirements): string | null {
  const parts: string[] = [];
  if (recs.teacher_max > 0) parts.push(countNoun(recs.teacher_min > 0 ? recs.teacher_min : recs.teacher_max, 'teacher recommendation'));
  if (recs.counselor_required) parts.push('one counselor recommendation');
  if (recs.other_max > 0) parts.push(`up to ${countNoun(recs.other_max, 'other recommendation')}`);
  if (parts.length === 0) return null;
  return `${schoolName} asks for ${joinList(parts)}.`;
}

const TEST_POLICY_SENTENCES: Record<TestPolicy, (schoolName: string, cycleLabel: string) => string> = {
  required: (_name, cycleLabel) => `Test scores are required for ${cycleLabel}.`,
  optional: (_name, cycleLabel) => `Test scores are optional for ${cycleLabel}.`,
  blind: (name) => `${name} does not consider test scores.`,
  flexible: (name, cycleLabel) => `${name} is test-flexible for ${cycleLabel}.`,
};

function aidSentence(schoolName: string, requirements: SchoolRequirementsData, timezone: string): string | null {
  const parts: string[] = [];
  if (requirements.css_profile.required) parts.push('the CSS Profile');
  if (requirements.fafsa_priority_deadline) {
    parts.push(`the FAFSA by ${formatDate(requirements.fafsa_priority_deadline, timezone)} for priority consideration`);
  }
  if (parts.length === 0) return null;
  return `${schoolName} asks for ${joinList(parts)}.`;
}

function feesSentence(schoolName: string, requirements: SchoolRequirementsData): string | null {
  const fee = requirements.application_fee;
  if (fee !== null) {
    if (fee === 0) return `${schoolName} does not charge an application fee.`;
    return `${schoolName}'s application fee is $${fee}.${requirements.fee_waiver_eligible ? ' Fee waivers are available.' : ''}`;
  }
  if (!requirements.fee_waiver_eligible) return `${schoolName} does not offer fee waivers.`;
  return null;
}

const INTERVIEW_SENTENCES: Partial<Record<InterviewPolicy, (schoolName: string) => string>> = {
  optional: (name) => `${name} offers an optional interview.`,
  recommended: (name) => `${name} recommends an interview.`,
  required: (name) => `${name} requires an interview.`,
  by_invitation: (name) => `${name} interviews by invitation.`,
};

/**
 * Turns one school's structured requirements into plain sentences, one short paragraph per topic
 * (essays, recommendations, tests, aid, fees, interviews), skipping any topic with nothing to say.
 * The caller renders `null` requirements as its own single sentence — this function only ever
 * sees a resolved `SchoolRequirementsData`.
 */
export function requirementsToSentences(schoolName: string, requirements: SchoolRequirementsData, timezone: string): string[] {
  const cycleLabel = cycleToFallLabel(requirements.cycle);
  const sentences: string[] = [];

  const essays = essaysSentence(schoolName, requirements.supplements);
  if (essays) sentences.push(essays);

  const recommendations = recommendationsSentence(schoolName, requirements.recommendations);
  if (recommendations) sentences.push(recommendations);

  sentences.push(TEST_POLICY_SENTENCES[requirements.test_policy](schoolName, cycleLabel));

  const aid = aidSentence(schoolName, requirements, timezone);
  if (aid) sentences.push(aid);

  const fees = feesSentence(schoolName, requirements);
  if (fees) sentences.push(fees);

  const interview = INTERVIEW_SENTENCES[requirements.interview_policy]?.(schoolName);
  if (interview) sentences.push(interview);

  return sentences;
}
