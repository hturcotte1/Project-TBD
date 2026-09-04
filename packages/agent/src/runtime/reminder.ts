import { eq } from 'drizzle-orm';
import { appendAudit, scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import type { AgentDeps } from './deps';

export interface RunReminderDraftInput {
  studentId: string;
  recommenderId: string;
  runId: string;
}

export interface RunReminderDraftResult {
  draftText: string;
}

/** Drafts a short check-in note for the STUDENT to send their recommender. The agent never contacts anyone itself. */
export async function runReminderDraft(deps: AgentDeps, input: RunReminderDraftInput): Promise<RunReminderDraftResult> {
  const sdb = scoped(deps.db, input.studentId);
  const recommender = await sdb.requireOne(S.recommenders, eq(S.recommenders.id, input.recommenderId));
  const assignments = await sdb.select(S.recommenderAssignments, eq(S.recommenderAssignments.recommenderId, recommender.id));

  let schoolName: string | null = null;
  const pending = assignments.find((a) => a.status !== 'submitted');
  if (pending) {
    const application = await sdb.selectOne(S.applications, eq(S.applications.id, pending.applicationId));
    if (application) {
      const schoolRows = await deps.db.select().from(S.schools).where(eq(S.schools.id, application.schoolId)).limit(1);
      schoolName = schoolRows[0]?.name ?? null;
    }
  }

  const prompt = [`Recommender: ${recommender.name}`, schoolName ? `School: ${schoolName}` : null].filter((p): p is string => Boolean(p)).join('\n');
  const response = await deps.llm.generate({
    task: 'reminder_draft',
    system:
      "Write a short, warm, polite note (about 3 sentences) that the STUDENT will send to their recommender themselves, checking in about a recommendation letter. Write it in the student's voice, for the student to review and send — never claim to be their agent or an AI.",
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    metadata: { studentId: input.studentId, runId: input.runId },
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  const draftText = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

  const runRow = await sdb.selectOne(S.agentRuns, eq(S.agentRuns.id, input.runId));
  await sdb.update(
    S.agentRuns,
    { metadata: { ...(runRow?.metadata ?? {}), draft_text: draftText, recommender_id: recommender.id } },
    eq(S.agentRuns.id, input.runId),
  );
  await appendAudit(sdb, { actor: 'agent', action: 'reminder.drafted', entityType: 'recommender', entityId: recommender.id });

  return { draftText };
}
