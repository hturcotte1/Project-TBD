/**
 * Small builder functions so the ~70 dataset entries can be written as compact, readable literals
 * while still producing objects that satisfy `SchoolRequirementsData` exactly (every field
 * required — zod's `.default()` only fills gaps when parsing raw input, not for a plain object
 * literal already typed as the output shape).
 */
import type { z } from 'zod';
import type { ApplicationPlan, InterviewPolicy, TestPolicy } from '../../domain/enums';
import type {
  CssProfileRequirement as CssProfileRequirementSchema,
  PlanRequirement,
  PortfolioRequirement as PortfolioRequirementSchema,
  RecommendationRequirements,
  SchoolRequirementsData,
  SupplementPrompt,
} from '../../schemas/requirements';
import type { SchoolDatasetEntry } from '../types';

export type CssProfileRequirementT = z.infer<typeof CssProfileRequirementSchema>;
export type PortfolioRequirementT = z.infer<typeof PortfolioRequirementSchema>;

const CYCLE = '2026-27';

/** One admission plan's deadline. */
export function plan(
  planName: ApplicationPlan,
  deadline: string,
  opts: { notes?: string; needs_verification?: boolean } = {},
): PlanRequirement {
  return {
    plan: planName,
    deadline,
    notes: opts.notes ?? '',
    needs_verification: opts.needs_verification ?? false,
  };
}

/** One supplement/essay prompt. */
export function supplement(
  id: string,
  title: string,
  prompt: string,
  opts: {
    word_limit?: number | null;
    required?: boolean;
    applies_to_plans?: ApplicationPlan[] | null;
    needs_verification?: boolean;
  } = {},
): SupplementPrompt {
  return {
    id,
    title,
    prompt,
    word_limit: opts.word_limit ?? null,
    required: opts.required ?? true,
    applies_to_plans: opts.applies_to_plans ?? null,
    needs_verification: opts.needs_verification ?? false,
  };
}

/** Letters-of-recommendation policy. */
export function recs(
  teacherMin: number,
  teacherMax: number,
  opts: { counselor_required?: boolean; other_max?: number; notes?: string } = {},
): RecommendationRequirements {
  return {
    teacher_min: teacherMin,
    teacher_max: teacherMax,
    counselor_required: opts.counselor_required ?? true,
    other_max: opts.other_max ?? 0,
    notes: opts.notes ?? '',
  };
}

export function cssProfile(deadline: string | null, opts: { needs_verification?: boolean } = {}): CssProfileRequirementT {
  return { required: true, deadline, needs_verification: opts.needs_verification ?? false };
}

export const NO_CSS_PROFILE: CssProfileRequirementT = { required: false, deadline: null, needs_verification: false };

export function portfolio(
  status: PortfolioRequirementT['status'],
  description = '',
): PortfolioRequirementT {
  return { status, description };
}

export const NO_PORTFOLIO: PortfolioRequirementT = { status: 'none', description: '' };

/** Assembles a full `SchoolRequirementsData`, filling in every default explicitly. */
export function requirements(input: {
  plans: PlanRequirement[];
  supplements?: SupplementPrompt[];
  recommendations: RecommendationRequirements;
  test_policy: TestPolicy;
  interview_policy?: InterviewPolicy;
  portfolio?: PortfolioRequirementT;
  midyear_report?: boolean;
  css_profile?: CssProfileRequirementT;
  fafsa_priority_deadline?: string | null;
  application_fee?: number | null;
  fee_waiver_eligible?: boolean;
  needs_verification?: boolean;
  notes?: string;
}): SchoolRequirementsData {
  return {
    cycle: CYCLE,
    plans: input.plans,
    supplements: input.supplements ?? [],
    recommendations: input.recommendations,
    test_policy: input.test_policy,
    interview_policy: input.interview_policy ?? 'none',
    portfolio: input.portfolio ?? NO_PORTFOLIO,
    midyear_report: input.midyear_report ?? true,
    css_profile: input.css_profile ?? NO_CSS_PROFILE,
    fafsa_priority_deadline: input.fafsa_priority_deadline ?? null,
    application_fee: input.application_fee ?? null,
    fee_waiver_eligible: input.fee_waiver_eligible ?? true,
    needs_verification: input.needs_verification ?? false,
    source: 'internal_dataset',
    notes: input.notes ?? '',
  };
}

/** Assembles a full `SchoolDatasetEntry`. Purely for readability/typing at each call site. */
export function school(entry: SchoolDatasetEntry): SchoolDatasetEntry {
  return entry;
}
