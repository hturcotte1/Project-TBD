import { z } from 'zod';
import { IsoDate } from './common';
import { COST_SENSITIVITIES, SCHOOL_SIZES, TEST_OPTIONAL_STANCES } from '../domain/enums';

export const Academics = z.object({
  gpa_weighted: z.number().min(0).max(6).nullable().default(null),
  gpa_unweighted: z.number().min(0).max(5).nullable().default(null),
  gpa_scale: z.number().min(4).max(6).nullable().default(null),
  class_rank: z.number().int().positive().nullable().default(null),
  class_size: z.number().int().positive().nullable().default(null),
  rigor_summary: z.string().max(1000).default(''),
  senior_courses: z.array(z.string().max(120)).max(15).default([]),
});
export type Academics = z.infer<typeof Academics>;

export const SatScore = z.object({
  total: z.number().int().min(400).max(1600),
  ebrw: z.number().int().min(200).max(800).nullable().default(null),
  math: z.number().int().min(200).max(800).nullable().default(null),
  date: IsoDate.nullable().default(null),
});
export const ActScore = z.object({
  composite: z.number().int().min(1).max(36),
  english: z.number().int().min(1).max(36).nullable().default(null),
  math: z.number().int().min(1).max(36).nullable().default(null),
  reading: z.number().int().min(1).max(36).nullable().default(null),
  science: z.number().int().min(1).max(36).nullable().default(null),
  date: IsoDate.nullable().default(null),
});
export const ApScore = z.object({
  subject: z.string().max(80),
  score: z.number().int().min(1).max(5).nullable().default(null),
  year: z.number().int().min(2015).max(2030).nullable().default(null),
});
export const IbScore = z.object({
  subject: z.string().max(80),
  level: z.enum(['HL', 'SL']).nullable().default(null),
  score: z.number().int().min(1).max(7).nullable().default(null),
  year: z.number().int().min(2015).max(2030).nullable().default(null),
});

export const TestScores = z.object({
  sat: z.array(SatScore).default([]),
  act: z.array(ActScore).default([]),
  ap: z.array(ApScore).default([]),
  ib: z.array(IbScore).default([]),
  test_optional_stance: z.enum(TEST_OPTIONAL_STANCES).default('undecided'),
});
export type TestScores = z.infer<typeof TestScores>;

/** Only what the student chose to share. Every field optional; absence means "not shared". */
export const Demographics = z.object({
  first_generation: z.boolean().nullable().default(null),
  financial_constraints: z.boolean().nullable().default(null),
  family_responsibilities: z.string().max(1000).nullable().default(null),
  household_notes: z.string().max(1000).nullable().default(null),
});
export type Demographics = z.infer<typeof Demographics>;

export const Goals = z.object({
  intended_majors: z.array(z.string().max(80)).max(5).default([]),
  geography: z.array(z.string().max(80)).max(10).default([]),
  sizes: z.array(z.enum(SCHOOL_SIZES)).default([]),
  cost_sensitivity: z.enum(COST_SENSITIVITIES).default('medium'),
  needs_aid: z.boolean().default(false),
  notes: z.string().max(2000).default(''),
});
export type Goals = z.infer<typeof Goals>;

export const QuietHours = z.object({
  /** "HH:MM" 24h local time when quiet hours begin. */
  start: z.string().regex(/^\d{2}:\d{2}$/),
  /** "HH:MM" 24h local time when quiet hours end. */
  end: z.string().regex(/^\d{2}:\d{2}$/),
});
export type QuietHours = z.infer<typeof QuietHours>;
