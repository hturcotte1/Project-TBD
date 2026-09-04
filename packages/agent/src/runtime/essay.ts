/**
 * Essay feedback and the ghostwriting boundary (DECISIONS.md #15). `EssayFeedback` has no field
 * where prose could travel back to the student — no suggested text, no rewrites, no examples —
 * so even a fully compliant model call cannot hand back writing. `containsProseHandback` is the
 * safety net for the rare case a model tries anyway inside a plain conversational reply.
 */
import { desc, eq } from 'drizzle-orm';
import { appendAudit, scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { EssayFeedback } from '@tbd/shared/schemas';
import { forExtraction } from '../llm/schema';
import type { AgentDeps } from './deps';

/** Each pattern matches one family of ghostwriting request. Keep matches specific to avoid flagging legitimate feedback asks. */
export const GHOSTWRITING_PATTERNS: RegExp[] = [
  /\bwrite it for me\b/i,
  /\brephrase (this|that|my)\b/i,
  /\ba version i can edit\b/i,
  /\bpolish (this|that|it|my)\b/i,
  /\bsound better\b/i,
  /\bsample essay\b/i,
  /\bdraft (the|my|this) .* for me\b/i,
  /\bfix my grammar\b/i,
  /\breword\b/i,
  /\bwhat would you write\b/i,
  /\bexample opening line\b/i,
  /\brewrite (this|that|it) in my voice\b/i,
  /\bghostwrite\b/i,
  /\byou write it\b/i,
  /\bcomplete my essay\b/i,
  /\bdo the first paragraph\b/i,
  /\btranslate my outline\b/i,
  /\bwrite (a|an|my) (paragraph|essay|opening|intro|conclusion) (about|for)\b/i,
  /\bgive me (a|an) (example|sample)\b/i,
];

export function isGhostwritingRequest(text: string): boolean {
  return GHOSTWRITING_PATTERNS.some((p) => p.test(text));
}

/** Detects a quoted or blockquoted passage of 40+ words — the safety net for a model handing back prose in plain text. */
export function containsProseHandback(text: string): boolean {
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  const blockquoteLines = text
    .split('\n')
    .filter((l) => l.trim().startsWith('>'))
    .map((l) => l.replace(/^\s*>+\s?/, ''));
  if (blockquoteLines.length > 0 && wordCount(blockquoteLines.join(' ')) >= 40) return true;

  const fenceRe = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text))) {
    if (wordCount(m[0].replace(/```/g, '')) >= 40) return true;
  }

  const quoteRe = /["“]([^"”]{20,6000})["”]/g;
  while ((m = quoteRe.exec(text))) {
    if (wordCount(m[1] ?? '') >= 40) return true;
  }

  return false;
}

const REFUSAL_TEXT =
  "I can't write or rewrite that for you — it's your application and it needs to be your voice, and schools treat AI-written essays as misconduct. I can ask you questions about it, help you outline, or give specific feedback on what you've already written. Want to try one of those?";

/** Used by the conversation runtime when the safety net trips: swap a prose handback for a refusal. */
export function ghostwritingRefusalText(): string {
  return REFUSAL_TEXT;
}

export interface RunEssayFeedbackInput {
  studentId: string;
  essayId: string;
  draftId: string;
  runId: string;
}

export interface RunEssayFeedbackResult {
  feedbackId: string;
  feedback: EssayFeedback;
}

/** Generates structured, non-generic feedback on one draft and records it. Never produces prose. */
export async function runEssayFeedback(deps: AgentDeps, input: RunEssayFeedbackInput): Promise<RunEssayFeedbackResult> {
  const sdb = scoped(deps.db, input.studentId);
  const essay = await sdb.requireOne(S.essays, eq(S.essays.id, input.essayId));
  const draft = await sdb.requireOne(S.essayDrafts, eq(S.essayDrafts.id, input.draftId));
  const narrativeRow = await sdb.selectOne(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version) });
  const priorFeedback = await sdb.select(S.essayFeedback, eq(S.essayFeedback.essayId, input.essayId), { orderBy: desc(S.essayFeedback.createdAt), limit: 3 });

  let schoolName: string | null = null;
  if (essay.applicationId) {
    const application = await sdb.selectOne(S.applications, eq(S.applications.id, essay.applicationId));
    if (application) {
      const schoolRows = await deps.db.select().from(S.schools).where(eq(S.schools.id, application.schoolId)).limit(1);
      schoolName = schoolRows[0]?.name ?? null;
    }
  }

  const promptParts = [
    `Prompt: ${essay.prompt}`,
    `Word limit: ${essay.wordLimit ?? 'none'}`,
    schoolName ? `School: ${schoolName}` : null,
    narrativeRow ? `Student narrative summary: ${narrativeRow.narrative.summary || '(no summary yet)'}` : null,
    narrativeRow ? `Voice notes: sentence style — ${narrativeRow.narrative.voice_notes.sentence_style || 'unknown'}; vocabulary — ${narrativeRow.narrative.voice_notes.vocabulary || 'unknown'}` : null,
    priorFeedback.length
      ? `Previous feedback already given (do not repeat these points verbatim): ${priorFeedback.map((f) => f.feedback.top_three_next_steps.join('; ')).join(' | ')}`
      : null,
    `Draft (the student's own words):\n${draft.content}`,
  ].filter((p): p is string => Boolean(p));

  const system =
    'You give specific, honest feedback on a college essay draft. Return ONLY the structured fields requested — never a rewritten sentence, paragraph, or example. Point at exact phrases the student used when you flag something generic.';

  const { data } = await deps.llm.extract<EssayFeedback>({
    task: 'essay_feedback',
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: promptParts.join('\n\n') }] }],
    schema: forExtraction(EssayFeedback),
    schemaName: 'EssayFeedback',
    metadata: { studentId: input.studentId, runId: input.runId },
  });

  const [row] = await sdb.insert(S.essayFeedback, { essayId: input.essayId, essayDraftId: input.draftId, agentRunId: input.runId, feedback: data });
  if (!row) throw new Error('failed to save essay feedback');

  const runRow = await sdb.selectOne(S.agentRuns, eq(S.agentRuns.id, input.runId));
  await sdb.update(S.agentRuns, { metadata: { ...(runRow?.metadata ?? {}), essay_id: input.essayId, feedback_id: row.id } }, eq(S.agentRuns.id, input.runId));
  await appendAudit(sdb, { actor: 'agent', action: 'essay.feedback_generated', entityType: 'essay', entityId: input.essayId, details: { feedback_id: row.id } });

  return { feedbackId: row.id, feedback: data };
}
