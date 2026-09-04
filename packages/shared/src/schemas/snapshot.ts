import { z } from 'zod';
import { Confidence, IsoDate } from './common';
import { APPLICATION_PLANS, STATE_CHANGE_KINDS, SIGNIFICANCES } from '../domain/enums';

export const SectionStatus = z.enum(['complete', 'in_progress', 'not_started', 'unknown']);
export type SectionStatus = z.infer<typeof SectionStatus>;

export const RecommenderEntry = z.object({
  name: z.string().max(120),
  role: z.enum(['teacher', 'counselor', 'other']),
  status: z.enum(['not_invited', 'invited', 'submitted', 'declined', 'unknown']),
  invited_at: IsoDate.nullable().default(null),
  submitted_at: IsoDate.nullable().default(null),
  subject: z.string().max(80).nullable().default(null),
});
export type RecommenderEntry = z.infer<typeof RecommenderEntry>;

export const SupplementEntry = z.object({
  title: z.string().max(200),
  required: z.boolean().nullable().default(null),
  status: SectionStatus,
  word_count: z.number().int().nonnegative().nullable().default(null),
});
export type SupplementEntry = z.infer<typeof SupplementEntry>;

export const CollegeSnapshot = z.object({
  name: z.string().max(200),
  common_app_college_id: z.string().max(60).nullable().default(null),
  plan: z.enum(APPLICATION_PLANS).nullable().default(null),
  deadline: IsoDate.nullable().default(null),
  questions_status: SectionStatus,
  supplements: z.array(SupplementEntry).default([]),
  writing_supplement_status: SectionStatus.default('unknown'),
  ferpa_status: z.enum(['complete', 'incomplete', 'unknown']).default('unknown'),
  counselor: RecommenderEntry.nullable().default(null),
  teachers: z.array(RecommenderEntry).default([]),
  others: z.array(RecommenderEntry).default([]),
  review_submit_status: z.enum(['not_ready', 'ready', 'submitted', 'unknown']).default('unknown'),
  fee_status: z.enum(['unpaid', 'paid', 'waived', 'not_required', 'unknown']).default('unknown'),
  submission_status: z.enum(['not_submitted', 'submitted', 'unknown']).default('unknown'),
  submitted_at: IsoDate.nullable().default(null),
});
export type CollegeSnapshot = z.infer<typeof CollegeSnapshot>;

export const CommonAppSections = z.object({
  profile: SectionStatus,
  family: SectionStatus,
  education: SectionStatus,
  testing: SectionStatus,
  activities: SectionStatus,
  activities_count: z.number().int().min(0).max(10).nullable().default(null),
  writing: z.object({
    status: SectionStatus,
    prompt_index: z.number().int().min(1).max(7).nullable().default(null),
    word_count: z.number().int().nonnegative().nullable().default(null),
  }),
  courses_grades: SectionStatus,
});

export const SelfReportedScore = z.object({
  test: z.string().max(40),
  score: z.string().max(40),
  date: IsoDate.nullable().default(null),
});

/** Normalized state of a Common App account at one moment. */
export const CommonAppSnapshot = z.object({
  captured_at: z.string().datetime({ offset: true }),
  account_email_masked: z.string().max(120).nullable().default(null),
  colleges: z.array(CollegeSnapshot),
  sections: CommonAppSections,
  testing: z.object({
    self_reported: z.array(SelfReportedScore).default([]),
    scores_sent_indicators: z.array(z.string().max(200)).default([]),
  }),
  /** Per-section extraction confidence; a section under 0.5 is flagged, never trusted. */
  confidence: z.record(z.string(), Confidence),
  low_confidence_sections: z.array(z.string()).default([]),
});
export type CommonAppSnapshot = z.infer<typeof CommonAppSnapshot>;

export const StateChange = z.object({
  kind: z.enum(STATE_CHANGE_KINDS),
  /** Human path, e.g. "colleges[University of Michigan].teachers[Ms. Park].status". */
  path: z.string().max(300),
  school_name: z.string().max(200).nullable().default(null),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  significance: z.enum(SIGNIFICANCES),
  summary: z.string().max(300),
});
export type StateChange = z.infer<typeof StateChange>;
