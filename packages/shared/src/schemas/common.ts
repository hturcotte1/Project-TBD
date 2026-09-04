import { z } from 'zod';

/** ISO date without time, e.g. 2026-11-01. Deadlines are dates resolved in the student's zone. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
export type IsoDate = z.infer<typeof IsoDate>;

/** ISO 8601 timestamp string on the wire. */
export const IsoDateTime = z.string().datetime({ offset: true });

/** 0..1 confidence attached to anything extracted from a page, document, or photo. */
export const Confidence = z.number().min(0).max(1);

export const Uuid = z.string().uuid();

/** Every piece of extracted data carries the raw text it came from so humans can audit it. */
export const Extracted = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, confidence: Confidence, raw: z.string().max(4000) });
