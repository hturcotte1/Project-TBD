import { z } from 'zod';
import { ACTIVITY_TIMINGS, ACTIVITY_TYPES, GRADE_LEVELS } from '../domain/enums';

/** Exactly the shape of a Common App Activities entry. */
export const ActivityInput = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  position: z.string().max(50),
  organization: z.string().max(100),
  description: z.string().max(150),
  grade_levels: z.array(z.enum(GRADE_LEVELS)).min(1),
  timing: z.array(z.enum(ACTIVITY_TIMINGS)).min(1),
  hours_per_week: z.number().min(0).max(168),
  weeks_per_year: z.number().int().min(1).max(52),
  continue_in_college: z.boolean(),
});
export type ActivityInput = z.infer<typeof ActivityInput>;

export const MAX_ACTIVITIES = 10;
export const ActivityList = z.array(ActivityInput).max(MAX_ACTIVITIES);
