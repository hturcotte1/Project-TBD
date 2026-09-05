import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebhookRequest } from '@apogee/shared/adapters';
import { FakeMessagingProvider } from './fake';

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected value to be defined');
  return value;
}

describe('FakeMessagingProvider memory behavior', () => {
  it('records sent texts with incrementing fake ids and a delivered status', async () => {
    const provider = new FakeMessagingProvider();
    const r1 = await provider.send({ to: '+15551234567', body: 'hi' });
    const r2 = await provider.send({ to: '+15551234567', body: 'again' });

    expect(r1).toMatchObject({ providerMessageId: expect.stringMatching(/^fake-1-[0-9a-f]{8}$/), status: 'delivered' });
    expect(r2).toMatchObject({ providerMessageId: expect.stringMatching(/^fake-2-[0-9a-f]{8}$/), status: 'delivered' });
    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0]).toMatchObject({ id: expect.stringMatching(/^fake-1-/), to: '+15551234567', body: 'hi', mediaUrl: null, kind: 'text' });
    expect(defined(provider.sent[0]).at).toBeInstanceOf(Date);
  });

  it('records media sends with a mediaUrl and kind media', async () => {
    const provider = new FakeMessagingProvider();
    const result = await provider.sendMedia({ to: '+15551234567', body: 'look', mediaUrl: 'https://example.com/a.png' });
    expect(provider.sent[0]).toMatchObject({ mediaUrl: 'https://example.com/a.png', kind: 'media', body: 'look' });
    expect(result.providerMessageId).toMatch(/^fake-1-/);
  });

  it('records vCard sends with kind vcard', async () => {
    const provider = new FakeMessagingProvider();
    await provider.sendContactCard('+15551234567', 'BEGIN:VCARD\r\nEND:VCARD\r\n');
    expect(provider.sent[0]).toMatchObject({ kind: 'vcard', mediaUrl: null });
  });

  it('records reactions', async () => {
    const provider = new FakeMessagingProvider();
    await provider.react({ to: '+15551234567', targetProviderMessageId: 'msg-1', reaction: 'love' });
    expect(provider.reactions).toEqual([
      expect.objectContaining({ to: '+15551234567', targetProviderMessageId: 'msg-1', reaction: 'love' }),
    ]);
  });

  it('records typing events', async () => {
    const provider = new FakeMessagingProvider();
    await provider.typing('+15551234567');
    expect(provider.typingEvents).toHaveLength(1);
    expect(defined(provider.typingEvents[0]).to).toBe('+15551234567');
  });

  it('defaults phoneNumber and exposes name "fake"', () => {
    const provider = new FakeMessagingProvider();
    expect(provider.phoneNumber).toBe('+15555550000');
    expect(provider.name).toBe('fake');
  });

  it('honours a custom phoneNumber', () => {
    const provider = new FakeMessagingProvider({ phoneNumber: '+15559990000' });
    expect(provider.phoneNumber).toBe('+15559990000');
  });
});

describe('FakeMessagingProvider.verifySignature', () => {
  it('accepts the exact x-fake-signature: fake header', () => {
    const provider = new FakeMessagingProvider();
    const req: WebhookRequest = { headers: { 'x-fake-signature': 'fake' }, rawBody: '{}', body: {}, query: {} };
    expect(provider.verifySignature(req)).toBe(true);
  });

  it('rejects any other value or a missing header', () => {
    const provider = new FakeMessagingProvider();
    expect(provider.verifySignature({ headers: { 'x-fake-signature': 'nope' }, rawBody: '{}', body: {}, query: {} })).toBe(false);
    expect(provider.verifySignature({ headers: {}, rawBody: '{}', body: {}, query: {} })).toBe(false);
  });
});

describe('FakeMessagingProvider.buildInboundRequest round trip', () => {
  it('parses back into a matching InboundMessageEvent', () => {
    const provider = new FakeMessagingProvider();
    const req = FakeMessagingProvider.buildInboundRequest({
      from: '+15551234567',
      to: '+15555550000',
      body: 'hey there',
      mediaUrls: ['https://example.com/a.png'],
      providerMessageId: 'in-1',
    });
    expect(provider.verifySignature(req)).toBe(true);
    const [event] = provider.parseInboundWebhook(req);
    expect(event).toMatchObject({
      kind: 'message',
      providerMessageId: 'in-1',
      from: '+15551234567',
      to: '+15555550000',
      body: 'hey there',
      mediaUrls: ['https://example.com/a.png'],
    });
  });

  it('generates a fake-in-<uuid> id and defaults `to` to the provider phone number when omitted', () => {
    const provider = new FakeMessagingProvider();
    const req = FakeMessagingProvider.buildInboundRequest({ from: '+15551234567', body: 'hi' });
    const event = defined(provider.parseInboundWebhook(req)[0]);
    expect(event.kind).toBe('message');
    if (event.kind === 'message') {
      expect(event.providerMessageId).toMatch(/^fake-in-[0-9a-f-]{36}$/);
      expect(event.to).toBe('+15555550000');
      expect(event.mediaUrls).toEqual([]);
    }
  });
});

describe('FakeMessagingProvider.parseInboundWebhook: status and reaction shapes', () => {
  it('parses a status payload', () => {
    const provider = new FakeMessagingProvider();
    const body = { kind: 'status' as const, providerMessageId: 'fake-1', status: 'delivered' as const };
    const [event] = provider.parseInboundWebhook({ headers: {}, rawBody: JSON.stringify(body), body, query: {} });
    expect(event).toMatchObject({ kind: 'status', providerMessageId: 'fake-1', status: 'delivered', error: null });
  });

  it('parses a status payload with an error', () => {
    const provider = new FakeMessagingProvider();
    const body = { kind: 'status' as const, providerMessageId: 'fake-1', status: 'failed' as const, error: 'boom' };
    const [event] = provider.parseInboundWebhook({ headers: {}, rawBody: JSON.stringify(body), body, query: {} });
    expect(event).toMatchObject({ kind: 'status', status: 'failed', error: 'boom' });
  });

  it('parses a reaction payload', () => {
    const provider = new FakeMessagingProvider();
    const body = { kind: 'reaction' as const, from: '+15551234567', reaction: 'love' as const, targetProviderMessageId: 'fake-1' };
    const [event] = provider.parseInboundWebhook({ headers: {}, rawBody: JSON.stringify(body), body, query: {} });
    expect(event).toMatchObject({ kind: 'reaction', from: '+15551234567', reaction: 'love', targetProviderMessageId: 'fake-1' });
  });

  it('returns [] for garbage input without throwing', () => {
    const provider = new FakeMessagingProvider();
    expect(provider.parseInboundWebhook({ headers: {}, rawBody: 'x', body: { kind: 'status' }, query: {} })).toEqual([]);
    expect(() => provider.parseInboundWebhook({ headers: {}, rawBody: 'x', body: null, query: {} })).not.toThrow();
  });
});

describe('FakeMessagingProvider typing state and recent-sent (no Redis)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports not-typing before any typing event', async () => {
    const provider = new FakeMessagingProvider();
    expect(await provider.getTypingState('+15551234567')).toBe(false);
  });

  it('reports typing immediately after typing(), and expires after the TTL', async () => {
    const provider = new FakeMessagingProvider();
    await provider.typing('+15551234567');
    expect(await provider.getTypingState('+15551234567')).toBe(true);

    vi.advanceTimersByTime(9_000);
    expect(await provider.getTypingState('+15551234567')).toBe(false);
  });

  it('recentSent returns the newest n messages to a number, most recent first, in memory', async () => {
    const provider = new FakeMessagingProvider();
    await provider.send({ to: '+15551234567', body: 'one' });
    await provider.send({ to: '+15559999999', body: 'other number' });
    await provider.send({ to: '+15551234567', body: 'two' });
    await provider.send({ to: '+15551234567', body: 'three' });

    const recent = await provider.recentSent('+15551234567', 2);
    expect(recent.map((r) => r.body)).toEqual(['three', 'two']);
  });
});
