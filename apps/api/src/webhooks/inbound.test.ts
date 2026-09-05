import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as S from '@apogee/shared/db/schema';
import { conversationsRepo, messagesRepo, scoped } from '@apogee/shared/db';
import { makeTestApp } from '../testHelpers';
import { handleInboundEvents, isAllowedMediaUrl } from './inbound';

describe('media url policy', () => {
  it('production accepts only public https hosts', () => {
    expect(isAllowedMediaUrl('https://cdn.example.com/a.jpg', true)).toBe(true);
    for (const bad of [
      'http://cdn.example.com/a.jpg',
      'https://localhost/a.jpg',
      'https://127.0.0.1/a.jpg',
      'https://10.0.0.5/a.jpg',
      'https://192.168.1.2/a.jpg',
      'https://172.16.0.1/a.jpg',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/a.jpg',
      'https://db.internal/a.jpg',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(isAllowedMediaUrl(bad, true), bad).toBe(false);
    }
  });
  it('development allows http and localhost for the fake provider', () => {
    expect(isAllowedMediaUrl('http://localhost:4000/dev/storage/x.png', false)).toBe(true);
    expect(isAllowedMediaUrl('ftp://localhost/x.png', false)).toBe(false);
  });
});

describe('inbound pipeline', () => {
  it('delivery status never moves backwards', async () => {
    const { deps, studentId } = await makeTestApp();
    const sdb = scoped(deps.db, studentId);
    const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
    const message = await messagesRepo.append(sdb, {
      conversationId: conversation.id,
      channel: 'imessage',
      direction: 'outbound',
      body: 'hi',
      providerMessageId: 'mono-1',
      deliveryStatus: 'delivered',
    });
    await handleInboundEvents(deps, 'fake', [{ kind: 'status', providerMessageId: 'mono-1', status: 'sent', error: null, at: new Date() }]);
    const [after] = await sdb.select(S.messages, eq(S.messages.id, message.id));
    expect(after?.deliveryStatus).toBe('delivered');
    await handleInboundEvents(deps, 'fake', [{ kind: 'status', providerMessageId: 'mono-1', status: 'read', error: null, at: new Date() }]);
    const [read] = await sdb.select(S.messages, eq(S.messages.id, message.id));
    expect(read?.deliveryStatus).toBe('read');
  });

  it('a failed attempt releases the idempotency marker so the provider retry is processed', async () => {
    const { deps, studentId } = await makeTestApp();
    const [student] = await deps.db.select().from(S.students).where(eq(S.students.id, studentId));
    const event = { kind: 'message' as const, providerMessageId: 'retry-1', from: student!.phoneE164!, to: '+15555550000', body: 'hello', mediaUrls: [], receivedAt: new Date() };
    const original = deps.enqueuer.enqueue.bind(deps.enqueuer);
    deps.enqueuer.enqueue = async () => {
      throw new Error('redis down');
    };
    await expect(handleInboundEvents(deps, 'fake', [event])).rejects.toThrow('redis down');
    expect(await deps.db.select().from(S.webhookEvents).where(eq(S.webhookEvents.providerEventId, 'retry-1'))).toHaveLength(0);
    deps.enqueuer.enqueue = original;
    await handleInboundEvents(deps, 'fake', [event]);
    expect(deps.enqueuer.ofName('agent.inbound_message')).toHaveLength(1);
    expect(await deps.db.select().from(S.webhookEvents).where(eq(S.webhookEvents.providerEventId, 'retry-1'))).toHaveLength(1);
  });

  it('an unknown phone number is recorded for admins, with the number masked', async () => {
    const { deps } = await makeTestApp();
    await handleInboundEvents(deps, 'fake', [{ kind: 'message', providerMessageId: 'ghost-9', from: '+19995551234', to: '+15555550000', body: 'who dis', mediaUrls: [], receivedAt: new Date() }]);
    const rows = await deps.db.select().from(S.auditLog).where(eq(S.auditLog.action, 'inbound.unknown_phone'));
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]!.details)).not.toContain('9995551234');
    expect(JSON.stringify(rows[0]!.details)).toContain('1234');
  });
});
