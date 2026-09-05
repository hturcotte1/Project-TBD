import { eq } from 'drizzle-orm';
import { scoped } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { conversationsRepo, messagesRepo } from '@apogee/shared/db';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from '../testHelpers';

describe('POST /webhooks/sendblue', () => {
  it('401s a forged signature', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/sendblue',
      headers: { 'content-type': 'application/json', 'x-fake-signature': 'wrong' },
      payload: JSON.stringify({ from: '+15550000000', body: 'hi' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('valid inbound message from a known student creates a message and enqueues agent.inbound_message', async () => {
    const { app, studentId, deps } = await makeTestApp();
    const sdb = scoped(deps.db, studentId);
    await sdb.db.update(S.students).set({ phoneE164: '+15551234567' }).where(eq(S.students.id, studentId));

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/sendblue',
      headers: { 'content-type': 'application/json', 'x-fake-signature': 'fake' },
      payload: JSON.stringify({ from: '+15551234567', body: 'hey there', providerMessageId: 'msg-1' }),
    });
    expect(res.statusCode).toBe(200);

    const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
    const messages = await messagesRepo.recent(sdb, conversation.id, 10);
    expect(messages.some((m) => m.providerMessageId === 'msg-1' && m.body === 'hey there' && m.direction === 'inbound')).toBe(true);
    expect(deps.enqueuer.ofName('agent.inbound_message').some((j) => j.payload.studentId === studentId)).toBe(true);
  });

  it('a duplicate providerMessageId creates only one webhook_events row and does not double-enqueue', async () => {
    const { app, studentId, deps } = await makeTestApp();
    const sdb = scoped(deps.db, studentId);
    await sdb.db.update(S.students).set({ phoneE164: '+15551234567' }).where(eq(S.students.id, studentId));

    const payload = JSON.stringify({ from: '+15551234567', body: 'hey there', providerMessageId: 'dup-1' });
    const headers = { 'content-type': 'application/json', 'x-fake-signature': 'fake' };
    await app.inject({ method: 'POST', url: '/webhooks/sendblue', headers, payload });
    await app.inject({ method: 'POST', url: '/webhooks/sendblue', headers, payload });

    const events = await deps.db.select().from(S.webhookEvents).where(eq(S.webhookEvents.providerEventId, 'dup-1'));
    expect(events.length).toBe(1);
    expect(deps.enqueuer.ofName('agent.inbound_message').length).toBe(1);
  });

  it('an unknown phone number is ignored with a 200 and no message stored', async () => {
    const { app, deps } = await makeTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/sendblue',
      headers: { 'content-type': 'application/json', 'x-fake-signature': 'fake' },
      payload: JSON.stringify({ from: '+19995550000', body: 'ghost', providerMessageId: 'ghost-1' }),
    });
    expect(res.statusCode).toBe(200);
    expect(deps.enqueuer.ofName('agent.inbound_message').length).toBe(0);
  });

  it('a status callback updates the message delivery status', async () => {
    const { app, studentId, deps } = await makeTestApp();
    const sdb = scoped(deps.db, studentId);
    const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
    const message = await messagesRepo.append(sdb, {
      conversationId: conversation.id,
      channel: 'imessage',
      direction: 'outbound',
      body: 'sent from vector',
      providerMessageId: 'out-1',
      deliveryStatus: 'sent',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/sendblue',
      headers: { 'content-type': 'application/json', 'x-fake-signature': 'fake' },
      payload: JSON.stringify({ kind: 'status', providerMessageId: 'out-1', status: 'delivered' }),
    });
    expect(res.statusCode).toBe(200);

    const rows = await sdb.select(S.messages, eq(S.messages.id, message.id));
    expect(rows[0]?.deliveryStatus).toBe('delivered');
    expect(rows[0]?.deliveredAt).not.toBeNull();
  });
});
