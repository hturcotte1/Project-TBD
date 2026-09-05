import { desc } from 'drizzle-orm';
import { appendAudit, conversationsRepo, messagesRepo, scoped } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { StudentNarrative } from '@apogee/shared/schemas';
import { forExtraction } from '../llm/schema';
import { INTERVIEW_TOPICS } from '../persona';
import type { AgentDeps } from './deps';

export interface RunNarrativeSummaryInput {
  studentId: string;
  runId: string;
}

export interface RunNarrativeSummaryResult {
  narrativeId: string;
  narrative: StudentNarrative;
}

/** Matches an assistant question against the interview topic list so the transcript can be tagged for extraction. */
function matchTopicKey(question: string): string | null {
  const q = question.toLowerCase();
  for (const topic of INTERVIEW_TOPICS) {
    const words = topic.prompt
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, '')
      .split(' ')
      .filter((w) => w.length > 4);
    if (words.length === 0) continue;
    const hits = words.filter((w) => q.includes(w)).length;
    if (hits / words.length > 0.4) return topic.key;
  }
  return null;
}

/** Summarizes the intake interview transcript into a `StudentNarrative` (strong model) and saves a new version. */
export async function runNarrativeSummary(deps: AgentDeps, input: RunNarrativeSummaryInput): Promise<RunNarrativeSummaryResult> {
  const sdb = scoped(deps.db, input.studentId);
  const conversation = await conversationsRepo.getOrCreate(sdb, 'interview');
  const messages = await messagesRepo.recent(sdb, conversation.id, 100);

  const lines: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || m.direction !== 'outbound' || !m.body) continue;
    const key = matchTopicKey(m.body);
    if (!key) continue;
    const answer = messages.slice(i + 1).find((x) => x.direction === 'inbound' && x.body);
    if (!answer) continue;
    lines.push(`[${key}] Q: ${m.body}\nA: ${answer.body}`);
  }
  const transcriptText = lines.length > 0 ? lines.join('\n\n') : 'No interview answers captured yet.';

  const { data } = await deps.llm.extract<StudentNarrative>({
    task: 'reconcile',
    system: 'Summarize this college-application intake interview into the requested structured narrative. Use only what the student actually said.',
    messages: [{ role: 'user', content: [{ type: 'text', text: transcriptText }] }],
    schema: forExtraction(StudentNarrative),
    schemaName: 'StudentNarrative',
    metadata: { studentId: input.studentId, runId: input.runId },
  });

  const priorVersions = await sdb.select(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version), limit: 1 });
  const nextVersion = (priorVersions[0]?.version ?? 0) + 1;
  const [row] = await sdb.insert(S.studentNarratives, { version: nextVersion, narrative: data, interviewConversationId: conversation.id });
  if (!row) throw new Error('failed to save narrative');

  await appendAudit(sdb, { actor: 'agent', action: 'narrative.summarized', entityType: 'student_narrative', entityId: row.id, details: { version: nextVersion } });
  return { narrativeId: row.id, narrative: data };
}
