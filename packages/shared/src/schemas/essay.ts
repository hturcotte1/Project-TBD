import { z } from 'zod';

const Note = z.object({ quote: z.string().max(300).nullable().default(null), note: z.string().max(500) });

/**
 * Structured essay feedback. There is deliberately no field where prose could be returned:
 * no suggested text, no rewrites, no examples. Only observations, questions, and next steps.
 */
export const EssayFeedback = z.object({
  answers_prompt: z.object({ verdict: z.enum(['yes', 'partially', 'no']), note: z.string().max(600) }),
  clarity: z.array(Note).max(6).default([]),
  structure: z.array(Note).max(6).default([]),
  generic_phrases: z.array(Note).max(8).default([]),
  voice_match: z.object({ matches: z.enum(['yes', 'mostly', 'no']), note: z.string().max(500) }),
  where_a_real_detail_would_be_stronger: z.array(Note).max(6).default([]),
  word_count: z.object({ current: z.number().int(), limit: z.number().int().nullable(), note: z.string().max(200) }),
  top_three_next_steps: z.array(z.string().max(300)).min(1).max(3),
  questions_to_ask_yourself: z.array(z.string().max(300)).max(5).default([]),
});
export type EssayFeedback = z.infer<typeof EssayFeedback>;
