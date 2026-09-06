import type { ApplicationPlan } from '@apogee/shared/domain';

/** Sentence-case labels for every application plan — covers all of packages/shared's
 * APPLICATION_PLANS enum, used in the countdown sentence and the palette's Schools group. */
export const PLAN_LABELS: Record<ApplicationPlan, string> = {
  ED: 'Early Decision',
  ED2: 'Early Decision 2',
  EA: 'Early Action',
  REA: 'Restrictive Early Action',
  RD: 'Regular Decision',
  rolling: 'Rolling',
};
