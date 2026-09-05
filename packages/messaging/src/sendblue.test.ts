import { describe, expect, it } from 'vitest';
import type { WebhookRequest } from '@apogee/shared/adapters';
import { MessagingError } from './errors';
import { SendblueProvider, type SendblueConfig } from './sendblue';
import { createMockSendblueFetch } from './test-utils/sendblue-fetch-mock';

const BASE_CONFIG: Omit<SendblueConfig, 'fetchImpl'> = {
  apiKeyId: 'key-id-123',
  apiSecretKey: 'secret-key-456',
  phoneNumber: '+18885551234',
  webhookSecret: 'whsec_test123',
  statusCallbackUrl: 'https://api.example.com/webhooks/sendblue',
};

function makeProvider(overrides: Partial<SendblueConfig> = {}, mockOverrides: Parameters<typeof createMockSendblueFetch>[0] = {}) {
  const mock = createMockSendblueFetch(mockOverrides);
  const provider = new SendblueProvider({ ...BASE_CONFIG, fetchImpl: mock.fetchImpl, ...overrides });
  return { provider, calls: mock.calls };
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}, query: Record<string, string | undefined> = {}): WebhookRequest {
  return { headers, rawBody: JSON.stringify(body), body, query };
}

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected value to be defined');
  return value;
}

describe('SendblueProvider.send', () => {
  it('POSTs to /api/send-message with auth headers and the right body', async () => {
    const { provider, calls } = makeProvider();
    const result = await provider.send({ to: '+19998887777', body: 'hello there' });

    expect(calls).toHaveLength(1);
    const call = defined(calls[0]);
    expect(call.url).toBe('https://api.sendblue.com/api/send-message');
    expect(call.method).toBe('POST');
    expect(call.headers['sb-api-key-id']).toBe('key-id-123');
    expect(call.headers['sb-api-secret-key']).toBe('secret-key-456');
    expect(call.headers['content-type']).toBe('application/json');
    expect(call.body).toEqual({
      from_number: '+18885551234',
      number: '+19998887777',
      content: 'hello there',
      status_callback: 'https://api.example.com/webhooks/sendblue',
    });
    expect(result).toEqual({ providerMessageId: 'mh-1', status: 'queued' });
  });

  it('omits status_callback when none is configured', async () => {
    const { provider, calls } = makeProvider({ statusCallbackUrl: null });
    await provider.send({ to: '+19998887777', body: 'hi' });
    expect(defined(calls[0]).body).not.toHaveProperty('status_callback');
  });
});

describe('SendblueProvider.sendMedia', () => {
  it('includes media_url and content in the request body', async () => {
    const { provider, calls } = makeProvider();
    await provider.sendMedia({ to: '+19998887777', body: 'a photo', mediaUrl: 'https://cdn.example.com/img.jpg' });

    const call = defined(calls[0]);
    expect(call.url).toBe('https://api.sendblue.com/api/send-message');
    expect(call.body).toMatchObject({
      number: '+19998887777',
      content: 'a photo',
      media_url: 'https://cdn.example.com/img.jpg',
    });
  });

  it('omits content when body is empty (e.g. a bare vCard send)', async () => {
    const { provider, calls } = makeProvider();
    await provider.sendMedia({ to: '+19998887777', body: '', mediaUrl: 'https://cdn.example.com/card.vcf' });
    expect(defined(calls[0]).body).not.toHaveProperty('content');
  });
});

describe('SendblueProvider.sendContactCard', () => {
  it('sends the vCard URL as media', async () => {
    const { provider, calls } = makeProvider();
    const result = await provider.sendContactCard('+19998887777', 'https://cdn.example.com/card.vcf');
    expect(defined(calls[0]).body).toMatchObject({ media_url: 'https://cdn.example.com/card.vcf' });
    expect(result.providerMessageId).toBe('mh-1');
  });

  it('throws a clear error when the vCard is not a URL', async () => {
    const { provider } = makeProvider();
    await expect(provider.sendContactCard('+19998887777', 'BEGIN:VCARD\nEND:VCARD')).rejects.toThrow(/hosted/i);
  });
});

describe('SendblueProvider.typing', () => {
  it('POSTs to /api/send-typing-indicator with number, from_number, and state', async () => {
    const { provider, calls } = makeProvider();
    await provider.typing('+19998887777');
    const call = defined(calls[0]);
    expect(call.url).toBe('https://api.sendblue.com/api/send-typing-indicator');
    expect(call.body).toEqual({ number: '+19998887777', from_number: '+18885551234', state: 'start' });
  });
});

describe('SendblueProvider.react', () => {
  it('POSTs to /api/send-reaction with from_number, message_handle, and reaction', async () => {
    const { provider, calls } = makeProvider();
    await provider.react({ to: '+19998887777', targetProviderMessageId: 'MH-1', reaction: 'love' });
    const call = defined(calls[0]);
    expect(call.url).toBe('https://api.sendblue.com/api/send-reaction');
    expect(call.body).toEqual({ from_number: '+18885551234', message_handle: 'MH-1', reaction: 'love' });
  });
});

describe('SendblueProvider retry and error behavior', () => {
  it('retries once on a 500 and succeeds on the second attempt', async () => {
    const { provider, calls } = makeProvider({}, { failuresByPath: { '/api/send-message': [500] } });
    const result = await provider.send({ to: '+19998887777', body: 'hi' });
    expect(calls).toHaveLength(2);
    expect(result.providerMessageId).toBe('mh-2');
  });

  it('throws a retryable MessagingError after exhausting the single retry on persistent 500s', async () => {
    const { provider, calls } = makeProvider({}, { failuresByPath: { '/api/send-message': [500, 500] } });
    await expect(provider.send({ to: '+19998887777', body: 'hi' })).rejects.toMatchObject({
      status: 500,
      retryable: true,
    });
    expect(calls).toHaveLength(2);
  });

  it('throws a retryable MessagingError after exhausting the retry on 429', async () => {
    const { provider } = makeProvider({}, { failuresByPath: { '/api/send-message': [429, 429] } });
    const err = await provider.send({ to: '+19998887777', body: 'hi' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MessagingError);
    expect((err as MessagingError).retryable).toBe(true);
  });

  it('throws a non-retryable MessagingError on 401 without retrying', async () => {
    const { provider, calls } = makeProvider({}, { failuresByPath: { '/api/send-message': [401] } });
    await expect(provider.send({ to: '+19998887777', body: 'hi' })).rejects.toMatchObject({
      status: 401,
      retryable: false,
    });
    expect(calls).toHaveLength(1);
  });
});

describe('SendblueProvider.verifySignature', () => {
  it('accepts the configured secret in the sb-signing-secret header', () => {
    const { provider } = makeProvider();
    const req = jsonRequest({}, { 'sb-signing-secret': 'whsec_test123' });
    expect(provider.verifySignature(req)).toBe(true);
  });

  it('accepts the configured secret as a query parameter', () => {
    const { provider } = makeProvider();
    const req = jsonRequest({}, {}, { secret: 'whsec_test123' });
    expect(provider.verifySignature(req)).toBe(true);
  });

  it('rejects a forged secret', () => {
    const { provider } = makeProvider();
    const req = jsonRequest({}, { 'sb-signing-secret': 'not-the-secret' });
    expect(provider.verifySignature(req)).toBe(false);
  });

  it('rejects a request with no secret at all', () => {
    const { provider } = makeProvider();
    const req = jsonRequest({}, {});
    expect(provider.verifySignature(req)).toBe(false);
  });

  it('fails closed when no webhookSecret is configured and allowUnsigned is not set', () => {
    const { provider } = makeProvider({ webhookSecret: null });
    const req = jsonRequest({}, { 'sb-signing-secret': 'whatever' });
    expect(provider.verifySignature(req)).toBe(false);
  });

  it('accepts unsigned requests when webhookSecret is null and allowUnsigned is true', () => {
    const { provider } = makeProvider({ webhookSecret: null, allowUnsigned: true });
    const req = jsonRequest({}, {});
    expect(provider.verifySignature(req)).toBe(true);
  });
});

describe('SendblueProvider.parseInboundWebhook', () => {
  it('parses a realistic RECEIVED payload into an InboundMessageEvent', () => {
    const { provider } = makeProvider();
    const payload = {
      accountEmail: 'agent@example.com',
      content: 'Hello!',
      is_outbound: false,
      status: 'RECEIVED',
      error_code: null,
      error_message: null,
      message_handle: '99DCC379-DD76-4712-BA65-11EFB33B8CD6',
      date_sent: '2025-12-12T15:41:20.932Z',
      date_updated: '2025-12-12T15:41:20.995Z',
      from_number: '+19998887777',
      number: '+19998887777',
      to_number: '+15122164639',
      was_downgraded: null,
      plan: 'dedicated',
      media_url: '',
      message_type: 'message',
    };
    const [event] = provider.parseInboundWebhook(jsonRequest(payload));
    expect(event).toEqual({
      kind: 'message',
      providerMessageId: '99DCC379-DD76-4712-BA65-11EFB33B8CD6',
      from: '+19998887777',
      to: '+15122164639',
      body: 'Hello!',
      mediaUrls: [],
      receivedAt: new Date('2025-12-12T15:41:20.932Z'),
    });
  });

  it('includes media_url in mediaUrls when present', () => {
    const { provider } = makeProvider();
    const payload = {
      content: '',
      is_outbound: false,
      status: 'RECEIVED',
      message_handle: 'MH-2',
      date_sent: '2025-12-12T15:41:20.932Z',
      from_number: '+19998887777',
      to_number: '+15122164639',
      media_url: 'https://cdn.sendblue.co/media/abc.jpg',
    };
    const event = defined(provider.parseInboundWebhook(jsonRequest(payload))[0]);
    expect(event.kind).toBe('message');
    if (event.kind === 'message') {
      expect(event.mediaUrls).toEqual(['https://cdn.sendblue.co/media/abc.jpg']);
    }
  });

  it('parses a DELIVERED status callback into a DeliveryStatusEvent', () => {
    const { provider } = makeProvider();
    const payload = {
      content: 'Hello world!',
      is_outbound: true,
      status: 'DELIVERED',
      error_message: null,
      message_handle: '5a17319e-cbcf-443e-897e-d8b0c04b1b09',
      date_sent: '2025-12-12T15:35:35.410Z',
      date_updated: '2025-12-12T15:36:01.000Z',
      from_number: '+18649820355',
      number: '+19998887777',
      to_number: '+19998887777',
    };
    const [event] = provider.parseInboundWebhook(jsonRequest(payload));
    expect(event).toEqual({
      kind: 'status',
      providerMessageId: '5a17319e-cbcf-443e-897e-d8b0c04b1b09',
      status: 'delivered',
      error: null,
      at: new Date('2025-12-12T15:36:01.000Z'),
    });
  });

  it('maps an ERROR status callback to failed with the error message', () => {
    const { provider } = makeProvider();
    const payload = {
      is_outbound: true,
      status: 'ERROR',
      error_message: 'Recipient blocked this number',
      message_handle: 'mh-err',
      date_updated: '2025-12-12T15:36:01.000Z',
    };
    const [event] = provider.parseInboundWebhook(jsonRequest(payload));
    expect(event).toMatchObject({ kind: 'status', status: 'failed', error: 'Recipient blocked this number' });
  });

  it.each([
    ['QUEUED', 'queued'],
    ['SENT', 'sent'],
  ] as const)('maps status callback %s to %s', (sendblueStatus, expected) => {
    const { provider } = makeProvider();
    const payload = {
      is_outbound: true,
      status: sendblueStatus,
      message_handle: `mh-${sendblueStatus}`,
      date_updated: '2025-12-12T15:36:01.000Z',
    };
    const [event] = provider.parseInboundWebhook(jsonRequest(payload));
    expect(event).toMatchObject({ kind: 'status', status: expected });
  });

  it('returns an empty array for an unrecognized payload shape, without throwing', () => {
    const { provider } = makeProvider();
    expect(provider.parseInboundWebhook(jsonRequest({ nonsense: true }))).toEqual([]);
    expect(() => provider.parseInboundWebhook(jsonRequest(null))).not.toThrow();
    expect(provider.parseInboundWebhook(jsonRequest(null))).toEqual([]);
    expect(provider.parseInboundWebhook(jsonRequest('not an object'))).toEqual([]);
  });
});
