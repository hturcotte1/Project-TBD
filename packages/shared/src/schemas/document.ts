import { z } from 'zod';
import { Confidence, IsoDate } from './common';
import { ActivityInput } from './activity';
import { Academics, TestScores } from './profile';

export const TranscriptCourse = z.object({
  name: z.string().max(120),
  grade: z.string().max(10).nullable().default(null),
  year: z.string().max(20).nullable().default(null),
  level: z.enum(['regular', 'honors', 'AP', 'IB', 'dual_enrollment', 'other']).default('regular'),
  credits: z.number().nullable().default(null),
});

export const TranscriptExtraction = z.object({
  academics: Academics.partial(),
  test_scores: TestScores.partial().optional(),
  courses: z.array(TranscriptCourse).default([]),
  school_name: z.string().max(200).nullable().default(null),
  confidence: Confidence,
  notes: z.string().max(1000).default(''),
});
export type TranscriptExtraction = z.infer<typeof TranscriptExtraction>;

export const ResumeExtraction = z.object({
  activities: z.array(ActivityInput).max(10),
  dropped: z.array(z.string().max(200)).default([]),
  confidence: Confidence,
  notes: z.string().max(1000).default(''),
});
export type ResumeExtraction = z.infer<typeof ResumeExtraction>;

/** What the agent found in a photo the student texted (teacher email, portal screenshot, ...). */
export const PhotoExtraction = z.object({
  kind: z.enum(['recommender_email', 'portal_screenshot', 'deadline_notice', 'other']),
  recommender_update: z
    .object({
      recommender_name: z.string().max(120),
      school_name: z.string().max(200).nullable().default(null),
      status: z.enum(['invited', 'submitted', 'declined', 'unknown']),
      evidence: z.string().max(500),
    })
    .nullable()
    .default(null),
  deadline_notice: z
    .object({ school_name: z.string().max(200), date: IsoDate, what: z.string().max(200) })
    .nullable()
    .default(null),
  summary: z.string().max(600),
  confidence: Confidence,
});
export type PhotoExtraction = z.infer<typeof PhotoExtraction>;

export const DocumentExtraction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('transcript'), data: TranscriptExtraction }),
  z.object({ type: z.literal('resume'), data: ResumeExtraction }),
  z.object({ type: z.literal('photo'), data: PhotoExtraction }),
]);
export type DocumentExtraction = z.infer<typeof DocumentExtraction>;
