import { z } from 'zod';
import { IsoDate } from './common';

export const WeeklyPlan = z.object({
  week_start: IsoDate,
  priorities: z
    .array(
      z.object({
        title: z.string().max(200),
        why: z.string().max(400),
        item_ids: z.array(z.string().uuid()).default([]),
        due: IsoDate.nullable().default(null),
      }),
    )
    .max(8),
  text_summary: z.string().max(1200),
});
export type WeeklyPlan = z.infer<typeof WeeklyPlan>;
