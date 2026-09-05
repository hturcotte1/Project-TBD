import { eq } from 'drizzle-orm';
import { appendAudit, conversationsRepo, messagesRepo, scoped } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
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
  // The one dependency most worth naming: a recommender invited for the nearest school who has not submitted.
  const pendingRec = nearest
    ? ctx.recommenders.find((r) => r.assignments.some((a) => a.assignment.applicationId === nearest.application.id && a.assignment.status === 'invited'))
    : undefined;
  const firstThing = nearest
    ? ` — first thing: ${nearest.school.name} ${nearest.application.plan} is in ${nearest.daysRemaining} days${pendingRec ? ` and ${pendingRec.recommender.name} hasn't submitted your rec yet` : ''}.`
    : '.';
  const connected = ctx.lastSyncedAt !== null;
  const text = `It's ${AGENT_NAME}. ${connected ? "I'm connected to your Common App and I'll" : "Once your Common App is connected I'll"} text you when something needs you${firstThing}`;

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
    // Sendblue can only attach media it can fetch, so the real provider gets the API's hosted vCard
    // URL; the fake provider accepts the vCard text directly.
    const card = deps.messaging.name === 'sendblue' ? `${deps.env.API_URL.replace(/\/$/, '')}/public/vector.vcf` : vcard(AGENT_NAME, deps.messaging.phoneNumber);
    await deps.messaging.sendContactCard(ctx.student.phoneE164, card);
  } catch (err) {
    deps.logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'welcome.contact_card_failed');
  }

  await deps.db.update(S.students).set({ welcomeSentAt: deps.clock.now() }).where(eq(S.students.id, input.studentId));
  await appendAudit(sdb, { actor: 'agent', action: 'welcome.sent', entityType: 'student', entityId: input.studentId });
}
