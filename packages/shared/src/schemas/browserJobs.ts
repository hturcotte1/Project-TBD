import { z } from 'zod';

export const ScreenshotRef = z.object({
  page: z.string().max(80),
  storage_key: z.string().max(500),
  taken_at: z.string().datetime({ offset: true }),
});
export type ScreenshotRef = z.infer<typeof ScreenshotRef>;

export const FillVerification = z.object({
  path: z.string().max(200),
  expected: z.string().max(10_000),
  observed: z.string().max(10_000).nullable(),
  matched: z.boolean(),
});

export const BrowserJobResult = z.object({
  pages_visited: z.array(z.string().max(80)).default([]),
  snapshot_id: z.string().uuid().nullable().default(null),
  changes_count: z.number().int().nonnegative().default(0),
  verification_requested: z.boolean().default(false),
  login_ok: z.boolean().nullable().default(null),
  fill_verifications: z.array(FillVerification).default([]),
  low_confidence_sections: z.array(z.string()).default([]),
  notes: z.string().max(1000).default(''),
});
export type BrowserJobResult = z.infer<typeof BrowserJobResult>;
