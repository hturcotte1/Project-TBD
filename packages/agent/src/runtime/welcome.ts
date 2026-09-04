import { eq } from 'drizzle-orm';
import { appendAudit, conversationsRepo, messagesRepo, scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { AGENT_NAME } from '../persona';
import { loadStudentContext } from '../context';
import type { AgentDeps } from './deps';

export interface SendWelcomeInput {
  studentId: string;
}

function vcard(name: string, phone: string): string {
  return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, `TEL;TYPE=CELL:${phone}`, 'END:VCARD'].join('\n');
}

/** The first text a student gets: who this is, and (if known) their nearest deadline — plus a contact card. */
export async function sendWelcome(deps: AgentDeps, input: SendWelcomeInput): Promise<void> {
  const sdb = scoped(deps.db, input.studentId);
  const ctx = await loadStudentContext(deps.db, input.studentId, deps.clock, deps.env);
  if (!ctx.student.phoneE164) return;

  const nearest = [...ctx.applications].sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity))[0];
  const deadlineNote = nearest ? ` Your nearest deadline is ${nearest.school.name}, ${nearest.application.deadline} — ${nearest.daysRemaining} days out.` : '';
  const preferredName = ctx.student.preferredName || ctx.student.firstName;
  const text = `hey${preferredName ? ` ${preferredName}` : ''} — it's ${AGENT_NAME}. I'm going to stick with you through this whole application process.${deadlineNote}`;

  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  const result = await deps.messaging.send({ to: ctx.student.phoneE164, body: text });
  await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    body: text,
    providerMessageId: result.providerMessageId,
    deliveryStatus: result.status,
  });

  try {
    await deps.messaging.sendContactCard(ctx.student.phoneE164, vcard(AGENT_NAME, deps.messaging.phoneNumber));
  } catch (err) {
    deps.logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'welcome.contact_card_failed');
  }

  await deps.db.update(S.students).set({ welcomeSentAt: deps.clock.now() }).where(eq(S.students.id, input.studentId));
  await appendAudit(sdb, { actor: 'agent', action: 'welcome.sent', entityType: 'student', entityId: input.studentId });
}
