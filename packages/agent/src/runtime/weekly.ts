import { eq } from 'drizzle-orm';
import { appendAudit, conversationsRepo, messagesRepo, scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { WeeklyPlan } from '@tbd/shared/schemas';
import { isQuietNow } from '@tbd/shared/time';
import { loadStudentContext } from '../context';
import { forExtraction } from '../llm/schema';
import type { AgentDeps } from './deps';

export interface RunWeeklyPlanInput {
  studentId: string;
  weekStart: string;
}

export interface RunWeeklyPlanResult {
  planId: string;
  sent: boolean;
}

/** Builds the week's plan from open next actions (strong model) and sends the top 3 unless it's quiet hours. */
export async function runWeeklyPlan(deps: AgentDeps, input: RunWeeklyPlanInput): Promise<RunWeeklyPlanResult> {
  const sdb = scoped(deps.db, input.studentId);
  const now = deps.clock.now();
  const ctx = await loadStudentContext(deps.db, input.studentId, deps.clock, deps.env);

  const [runRow] = await sdb.insert(S.agentRuns, { trigger: 'weekly_plan', model: deps.env.LLM_STRONG_MODEL, outcome: 'running' });
  if (!runRow) throw new Error('failed to create agent run');

  const lines = ctx.openNextActions
    .slice(0, 15)
    .map((a) => `- ${a.action} | ${a.reason} | due:${a.dueDate ?? 'none'} | items:${a.applicationItemId ?? ''}`)
    .join('\n');
  const prompt = [`Week start: ${input.weekStart}`, 'Open next actions:', lines || '(none)'].join('\n');

  const { data } = await deps.llm.extract<WeeklyPlan>({
    task: 'weekly_plan',
    system: 'Build a plan of at most 8 priorities for this week from the actions given. Do not invent actions that were not listed.',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    schema: forExtraction(WeeklyPlan),
    schemaName: 'WeeklyPlan',
    metadata: { studentId: input.studentId, runId: runRow.id },
  });

  const [row] = await sdb.insert(S.weeklyPlans, { weekStart: input.weekStart, plan: data, agentRunId: runRow.id });
  if (!row) throw new Error('failed to save weekly plan');

  let sent = false;
  const quiet = ctx.student.phoneE164 ? isQuietNow(now, ctx.student.timezone, { start: ctx.student.quietHoursStart, end: ctx.student.quietHoursEnd }) : true;
  if (ctx.student.phoneE164 && !quiet) {
    const top3 = data.priorities.slice(0, 3).map((p) => p.title).join(', ');
    const text = data.text_summary || `This week: ${top3}.`;
    const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
    const result = await deps.messaging.send({ to: ctx.student.phoneE164, body: text });
    await messagesRepo.append(sdb, {
      conversationId: conversation.id,
      channel: 'imessage',
      direction: 'outbound',
      body: text,
      providerMessageId: result.providerMessageId,
      deliveryStatus: result.status,
      proactive: true,
      agentRunId: runRow.id,
    });
    sent = true;
  }

  await sdb.update(S.agentRuns, { outcome: 'completed', metadata: { weekly_plan_id: row.id, sent } }, eq(S.agentRuns.id, runRow.id));
  await appendAudit(sdb, { actor: 'agent', action: 'weekly_plan.generated', entityType: 'weekly_plan', entityId: row.id, details: { sent } });

  return { planId: row.id, sent };
}
