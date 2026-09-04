import { z } from 'zod';

export const FillField = z.object({
  /** Stable path inside the section, e.g. "activities[0].description" or "questions.q_intended_major". */
  path: z.string().max(200),
  label: z.string().max(200),
  value: z.union([z.string().max(10_000), z.number(), z.boolean()]),
});

export const FillFieldsPayload = z.object({
  kind: z.literal('fill_fields'),
  section: z.enum(['activities', 'college_questions', 'personal_essay', 'profile']),
  school_slug: z.string().max(100).nullable().default(null),
  fields: z.array(FillField).min(1).max(200),
  /** Origin of the values: required so the writer can refuse anything not authored by the student. */
  origin: z.enum(['student_profile', 'student_message', 'dashboard_editor']),
});
export type FillFieldsPayload = z.infer<typeof FillFieldsPayload>;

export const SubmitPayload = z.object({
  kind: z.literal('submit'),
  school_slug: z.string().max(100),
});

export const CustomApprovalPayload = z.object({
  kind: z.literal('custom'),
  description: z.string().max(1000),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const ApprovalPayload = z.discriminatedUnion('kind', [FillFieldsPayload, SubmitPayload, CustomApprovalPayload]);
export type ApprovalPayload = z.infer<typeof ApprovalPayload>;
