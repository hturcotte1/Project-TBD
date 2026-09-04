import { z } from 'zod';
import { IsoDate } from './common';
import { APPLICATION_PLANS, INTERVIEW_POLICIES, REQUIREMENT_SOURCES, TEST_POLICIES } from '../domain/enums';

export const PlanRequirement = z.object({
  plan: z.enum(APPLICATION_PLANS),
  deadline: IsoDate,
  /** Priority/aid-related deadline for rolling plans, if different. */
  notes: z.string().max(300).default(''),
  needs_verification: z.boolean().default(false),
});
export type PlanRequirement = z.infer<typeof PlanRequirement>;

export const SupplementPrompt = z.object({
  /** Stable id within the school, e.g. "why_us". Used to build item rule keys. */
  id: z.string().max(60),
  title: z.string().max(120),
  prompt: z.string().max(2000),
  word_limit: z.number().int().positive().nullable().default(null),
  required: z.boolean().default(true),
  /** If set, the prompt only applies to these plans (e.g. honors-college essay for EA). */
  applies_to_plans: z.array(z.enum(APPLICATION_PLANS)).nullable().default(null),
  needs_verification: z.boolean().default(false),
});
export type SupplementPrompt = z.infer<typeof SupplementPrompt>;

export const RecommendationRequirements = z.object({
  teacher_min: z.number().int().min(0).max(4).default(0),
  teacher_max: z.number().int().min(0).max(4).default(0),
  counselor_required: z.boolean().default(true),
  other_max: z.number().int().min(0).max(4).default(0),
  notes: z.string().max(300).default(''),
});
export type RecommendationRequirements = z.infer<typeof RecommendationRequirements>;

export const CssProfileRequirement = z.object({
  required: z.boolean(),
  deadline: IsoDate.nullable().default(null),
  needs_verification: z.boolean().default(false),
});

export const PortfolioRequirement = z.object({
  status: z.enum(['none', 'optional', 'required_for_majors', 'required']),
  description: z.string().max(300).default(''),
});

/** One school for one admission cycle. */
export const SchoolRequirementsData = z.object({
  cycle: z.string().regex(/^\d{4}-\d{2}$/),
  plans: z.array(PlanRequirement).min(1),
  supplements: z.array(SupplementPrompt).default([]),
  recommendations: RecommendationRequirements,
  test_policy: z.enum(TEST_POLICIES),
  interview_policy: z.enum(INTERVIEW_POLICIES).default('none'),
  portfolio: PortfolioRequirement.default({ status: 'none', description: '' }),
  midyear_report: z.boolean().default(true),
  css_profile: CssProfileRequirement.default({ required: false, deadline: null, needs_verification: false }),
  fafsa_priority_deadline: IsoDate.nullable().default(null),
  application_fee: z.number().min(0).nullable().default(null),
  fee_waiver_eligible: z.boolean().default(true),
  needs_verification: z.boolean().default(false),
  source: z.enum(REQUIREMENT_SOURCES).default('internal_dataset'),
  notes: z.string().max(1000).default(''),
});
export type SchoolRequirementsData = z.infer<typeof SchoolRequirementsData>;
