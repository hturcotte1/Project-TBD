import { describe, expect, it } from 'vitest';
import type { MessagingProvider, WebhookRequest } from '@apogee/shared/adapters';
import { DELIVERY_STATUSES } from '@apogee/shared/domain';
import { FakeMessagingProvider } from './fake';
import { SendblueProvider } from './sendblue';
import { createMockSendblueFetch } from './test-utils/sendblue-fetch-mock';

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected value to be defined');
  return value;
}

/** Everything the shared contract suite needs, built fresh (state doesn't leak between tests). */
interface ProviderHarness {
  provider: MessagingProvider;
  reactionTargetId: string;
  buildSignedInboundMessage(input: { from: string; to: string; body: string; mediaUrls?: string[]; providerMessageId: string }): WebhookRequest;
  buildSignedStatus(input: { providerMessageId: string; status: (typeof DELIVERY_STATUSES)[number] }): WebhookRequest;
  buildForged(): WebhookRequest;
  /** The media URL of the most recent sendMedia call, however the provider records it. */
  getLastSentMediaUrl(): string | null;
}

function runMessagingProviderContract(name: string, makeHarness: () => ProviderHarness) {
  describe(`MessagingProvider contract: ${name}`, () => {
    it('send returns a provider message id and a valid delivery status', async () => {
      const { provider } = makeHarness();
      const result = await provider.send({ to: '+15551234567', body: 'hello from the contract suite' });
      expect(typeof result.providerMessageId).toBe('string');
      expect(result.providerMessageId.length).toBeGreaterThan(0);
      expect(DELIVERY_STATUSES).toContain(result.status);
    });

    it('sendMedia carries the media URL through to the provider', async () => {
      const h = makeHarness();
      const url = 'https://cdn.example.com/contract-test.png';
      await h.provider.sendMedia({ to: '+15551234567', body: 'check this out', mediaUrl: url });
      expect(h.getLastSentMediaUrl()).toBe(url);
    });

    it('typing resolves without throwing', async () => {
      const { provider } = makeHarness();
      await expect(provider.typing('+15551234567')).resolves.toBeUndefined();
    });

    it('react resolves without throwing', async () => {
      const h = makeHarness();
      await expect(
        h.provider.react({ to: '+15551234567', targetProviderMessageId: h.reactionTargetId, reaction: 'love' }),
      ).resolves.toBeUndefined();
    });

    it('rejects a forged webhook signature', () => {
      const h = makeHarness();
      expect(h.provider.verifySignature(h.buildForged())).toBe(false);
    });

    it('accepts a legitimately signed webhook request', () => {
      const h = makeHarness();
      const req = h.buildSignedInboundMessage({
        from: '+15551234567',
        to: '+15555550000',
        body: 'signed and legit',
        providerMessageId: 'contract-sig-1',
      });
      expect(h.provider.verifySignature(req)).toBe(true);
    });

    it('round-trips an inbound message through parseInboundWebhook', () => {
      const h = makeHarness();
      const req = h.buildSignedInboundMessage({
        from: '+15551234567',
        to: '+15555550000',
        body: 'round trip message',
        mediaUrls: ['https://cdn.example.com/photo.jpg'],
        providerMessageId: 'contract-msg-1',
      });
      const events = h.provider.parseInboundWebhook(req);
      expect(events).toHaveLength(1);
      const event = defined(events[0]);
      expect(event.kind).toBe('message');
      if (event.kind !== 'message') return;
      expect(event.from).toBe('+15551234567');
      expect(event.body).toBe('round trip message');
      expect(event.mediaUrls).toEqual(['https://cdn.example.com/photo.jpg']);
      expect(event.receivedAt).toBeInstanceOf(Date);
    });

    it('round-trips a status update through parseInboundWebhook', () => {
      const h = makeHarness();
      const req = h.buildSignedStatus({ providerMessageId: 'contract-status-1', status: 'delivered' });
      const events = h.provider.parseInboundWebhook(req);
      expect(events).toHaveLength(1);
      const event = defined(events[0]);
      expect(event.kind).toBe('status');
      if (event.kind !== 'status') return;
      expect(event.providerMessageId).toBe('contract-status-1');
      expect(event.status).toBe('delivered');
    });
  });
}

// --- Fake provider harness ---------------------------------------------------------------

function makeFakeHarness(): ProviderHarness {
  const provider = new FakeMessagingProvider();
  return {
    provider,
    reactionTargetId: 'fake-1',
    buildSignedInboundMessage: (input) => FakeMessagingProvider.buildInboundRequest(input),
    buildSignedStatus: (input) => {
      const body = { kind: 'status' as const, providerMessageId: input.providerMessageId, status: input.status };
      return { headers: { 'x-fake-signature': 'fake' }, rawBody: JSON.stringify(body), body, query: {} };
    },
    buildForged: () => ({ headers: { 'x-fake-signature': 'forged' }, rawBody: '{}', body: {}, query: {} }),
    getLastSentMediaUrl: () => {
      const last = provider.sent[provider.sent.length - 1];
      return last?.mediaUrl ?? null;
    },
  };
}

runMessagingProviderContract('fake', makeFakeHarness);

// --- Sendblue provider harness (mocked fetch) ---------------------------------------------

const WEBHOOK_SECRET = 'whsec_contract_suite';

function makeSendblueHarness(): ProviderHarness {
  const mock = createMockSendblueFetch();
  const provider = new SendblueProvider({
    apiKeyId: 'key-id',
    apiSecretKey: 'secret-key',
    phoneNumber: '+15555550000',
    webhookSecret: WEBHOOK_SECRET,
    statusCallbackUrl: null,
    fetchImpl: mock.fetchImpl,
  });
  return {
    provider,
    reactionTargetId: 'CONTRACT-MH-1',
    buildSignedInboundMessage: (input) => {
      const body = {
        content: input.body,
        is_outbound: false,
        status: 'RECEIVED',
        message_handle: input.providerMessageId,
        date_sent: new Date().toISOString(),
        from_number: input.from,
        to_number: input.to,
        media_url: input.mediaUrls?.[0] ?? '',
      };
      return { headers: { 'sb-signing-secret': WEBHOOK_SECRET }, rawBody: JSON.stringify(body), body, query: {} };
    },
    buildSignedStatus: (input) => {
      const body = {
        is_outbound: true,
        status: input.status.toUpperCase(),
        message_handle: input.providerMessageId,
        date_updated: new Date().toISOString(),
      };
      return { headers: { 'sb-signing-secret': WEBHOOK_SECRET }, rawBody: JSON.stringify(body), body, query: {} };
    },
    buildForged: () => ({ headers: { 'sb-signing-secret': 'wrong-secret' }, rawBody: '{}', body: {}, query: {} }),
    getLastSentMediaUrl: () => {
      const last = mock.calls[mock.calls.length - 1];
      const value = last?.body?.media_url;
      return typeof value === 'string' && value.length > 0 ? value : null;
    },
  };
}

runMessagingProviderContract('sendblue (mocked fetch)', makeSendblueHarness);

// Sendblue's inbound webhook has no documented reaction event (see sendblue.ts), so the generic
// contract above only covers message/status round-trips. FakeMessagingProvider does support a
// reaction webhook shape; that extra behavior is tested directly here instead of being forced
// into the generic harness shape.
describe('FakeMessagingProvider reaction round-trip (contract extra)', () => {
  it('parses a reaction payload into a ReactionEvent', () => {
    const provider = new FakeMessagingProvider();
    const body = { kind: 'reaction' as const, from: '+15551234567', reaction: 'love' as const, targetProviderMessageId: 'fake-1' };
    const req: WebhookRequest = { headers: { 'x-fake-signature': 'fake' }, rawBody: JSON.stringify(body), body, query: {} };
    const [event] = provider.parseInboundWebhook(req);
    expect(event).toMatchObject({ kind: 'reaction', from: '+15551234567', reaction: 'love', targetProviderMessageId: 'fake-1' });
  });
});
