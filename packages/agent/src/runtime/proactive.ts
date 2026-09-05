import { appendAudit, AuthorizationError, conversationsRepo, messagesRepo, nudgesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import type { TriggerEvent } from '@tbd/shared/schemas';
import { factsMentioned, templateForTrigger } from '../integrations/shared-engines';
import type { AgentDeps } from './deps';

const MAX_LEN = 320;

export interface PhrasedBatch {
  batch: TriggerEvent[];
  text: string;
  source: 'llm' | 'template';
}

export interface PhraseNudgesInput {
  studentId: string;
  batches: TriggerEvent[][];
}

function mergedFacts(batch: TriggerEvent[]): Record<string, string | number | boolean | null> {
  return batch.reduce<Record<string, string | number | boolean | null>>((acc, t) => ({ ...acc, ...t.facts }), {});
}

/** One LLM call per batch, phrasing ONLY the given facts; falls back to the deterministic template when the model's text fails validation. */
export async function phraseNudges(deps: AgentDeps, input: PhraseNudgesInput): Promise<PhrasedBatch[]> {
  const out: PhrasedBatch[] = [];
  for (const batch of input.batches) {
    if (batch.length === 0) continue;
    const facts = mergedFacts(batch);
    const kinds = [...new Set(batch.map((t) => t.kind))].join(', ');
    const prompt = [
      `Write ONE short text message (<= ${MAX_LEN} characters) for a high-school senior applying to college.`,
      'Use ONLY the facts below. Never invent a school name, date, or number that is not listed.',
      `Trigger kind(s): ${kinds}`,
      `FACTS_JSON: ${JSON.stringify(facts)}`,
    ].join('\n');

    // Custom triggers carry their exact message (e.g. a held reconnect notice); the model never rewrites them.
    if (batch.every((t) => t.kind === 'custom')) {
      out.push({ batch, text: batch.map((t) => templateForTrigger(t)).join(' '), source: 'template' });
      continue;
    }

    let text = '';
    try {
      const response = await deps.llm.generate({
        task: 'prioritization',
        effort: 'low',
        system: 'You write short, warm, fact-only text messages for a college-application assistant. Never invent a fact not given to you.',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        metadata: { studentId: input.studentId },
      });
      const candidate = response.content.find((b) => b.type === 'text');
      text = candidate && candidate.type === 'text' ? candidate.text.trim() : '';
    } catch {
      text = '';
    }

    const valid = text.length > 0 && text.length <= MAX_LEN && batch.every((t) => factsMentioned(text, t));
    if (valid) {
      out.push({ batch, text, source: 'llm' });
    } else {
      out.push({ batch, text: batch.map((t) => templateForTrigger(t)).join(' '), source: 'template' });
    }
  }
  return out;
}

export interface SendProactiveInput {
  studentId: string;
  phrased: PhrasedBatch[];
}

/** Sends each phrased batch, records the outbound message (proactive=true) and one nudge per trigger. */
export async function sendProactive(deps: AgentDeps, input: SendProactiveInput): Promise<{ sent: number }> {
  const sdb = scoped(deps.db, input.studentId);
  const student = await studentsRepo.findById(deps.db, input.studentId);
  if (!student) throw new AuthorizationError();
  if (!student.phoneE164) return { sent: 0 };
  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');

  let sent = 0;
  for (const { batch, text } of input.phrased) {
    if (!text) continue;
    // A retried job must not text twice: skip batches whose triggers were all already recorded.
    const alreadySent = await Promise.all(batch.map((t) => nudgesRepo.wasSent(sdb, t.trigger_key)));
    if (alreadySent.every(Boolean)) continue;
    const result = await deps.messaging.send({ to: student.phoneE164, body: text });
    const row = await messagesRepo.append(sdb, {
      conversationId: conversation.id,
      channel: 'imessage',
      direction: 'outbound',
      body: text,
      providerMessageId: result.providerMessageId,
      deliveryStatus: result.status,
      proactive: true,
    });
    for (const trigger of batch) {
      await nudgesRepo.recordSent(sdb, {
        kind: trigger.kind,
        triggerKey: trigger.trigger_key,
        applicationItemId: trigger.application_item_id,
        applicationId: trigger.application_id,
        messageId: row.id,
      });
    }
    await appendAudit(sdb, { actor: 'agent', action: 'proactive.sent', entityType: 'message', entityId: row.id, details: { triggers: batch.map((t) => t.trigger_key) } });
    sent++;
  }
  return { sent };
}
