import { z } from 'zod';

export const ToolCallRecord = z.object({
  name: z.string().max(60),
  /** Redacted, short summary of the input; never essay text or credentials. */
  input_summary: z.string().max(300),
  ok: z.boolean(),
  duration_ms: z.number().int().nonnegative(),
  error: z.string().max(300).nullable().default(null),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecord>;
