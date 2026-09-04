import { z } from 'zod';
import { Confidence } from './common';

export const ItemEvidence = z.object({
  seen_at: z.string().datetime({ offset: true }),
  text: z.string().max(500),
  confidence: Confidence,
  source_url: z.string().max(500).nullable().default(null),
});
export type ItemEvidence = z.infer<typeof ItemEvidence>;
