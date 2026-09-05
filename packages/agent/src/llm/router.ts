import type { Env } from '@apogee/shared/config';
import type { LLMTask } from '@apogee/shared/adapters';

/** Tasks routed to the strong model (DECISIONS.md #11): essay feedback, weekly plans, reconciling ambiguous state. */
const STRONG_TASKS: ReadonlySet<LLMTask> = new Set<LLMTask>(['essay_feedback', 'weekly_plan', 'reconcile']);

/**
 * conversation / interview / extraction / prioritization / reminder_draft -> LLM_DEFAULT_MODEL.
 * essay_feedback / weekly_plan / reconcile -> LLM_STRONG_MODEL.
 */
export function modelForTask(task: LLMTask, env: Env): string {
  return STRONG_TASKS.has(task) ? env.LLM_STRONG_MODEL : env.LLM_DEFAULT_MODEL;
}
