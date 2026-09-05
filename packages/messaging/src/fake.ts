import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type {
  DeliveryStatusEvent,
  InboundEvent,
  InboundMessageEvent,
  MessagingProvider,
  OutboundMedia,
  OutboundMessage,
  ReactionEvent,
  SendResult,
  Tapback,
  WebhookRequest,
} from '@apogee/shared/adapters';
import { DELIVERY_STATUSES } from '@apogee/shared/domain';
import { createLogger, type Logger } from '@apogee/shared/logging';

const DEFAULT_PHONE_NUMBER = '+15555550000';
const TYPING_TTL_SECONDS = 8;
const MAX_RECENT_SENT = 500;

export type FakeSentKind = 'text' | 'media' | 'vcard';

export interface FakeSentRecord {
  id: string;
  to: string;
  body: string;
  mediaUrl: string | null;
  kind: FakeSentKind;
  at: Date;
}

export interface FakeReactionRecord {
  to: string;
  targetProviderMessageId: string;
  reaction: Tapback;
  at: Date;
}

export interface FakeTypingRecord {
  to: string;
  at: Date;
}

export interface FakeMessagingProviderOptions {
  /** When present, typing state and sent history are also mirrored to Redis for /dev/phone. */
  redis?: Redis;
  logger?: Logger;
  phoneNumber?: string;
}

const TapbackSchema = z.enum(['love', 'like', 'dislike', 'laugh', 'emphasize', 'question']);

const FakeInboundMessageBodySchema = z.object({
  kind: z.literal('message').optional(),
  from: z.string().min(1),
  to: z.string().optional(),
  body: z.string(),
  mediaUrls: z.array(z.string()).optional(),
  providerMessageId: z.string().optional(),
  receivedAt: z.string().optional(),
});

const FakeInboundStatusBodySchema = z.object({
  kind: z.literal('status'),
  providerMessageId: z.string().min(1),
  status: z.enum(DELIVERY_STATUSES),
  error: z.string().nullable().optional(),
});

const FakeInboundReactionBodySchema = z.object({
  kind: z.literal('reaction'),
  from: z.string().min(1),
  reaction: TapbackSchema,
  targetProviderMessageId: z.string().min(1),
});

/** Just enough structure to route the body to the right schema above. */
const FakeInboundKindPeekSchema = z.object({ kind: z.enum(['message', 'status', 'reaction']).optional() }).passthrough();

interface FakeStoredSent {
  id: string;
  to: string;
  body: string;
  mediaUrl: string | null;
  kind: FakeSentKind;
  at: string;
}

/**
 * In-memory (and optionally Redis-backed) MessagingProvider for local dev and tests. The Redis
 * mirror is what powers `/dev/phone`: it lets the API process (which sends messages) and a
 * browser polling the dev phone page (which may be a different process) see the same state.
 */
export class FakeMessagingProvider implements MessagingProvider {
  readonly name = 'fake' as const;
  readonly phoneNumber: string;
  readonly sent: FakeSentRecord[] = [];
  readonly reactions: FakeReactionRecord[] = [];
  readonly typingEvents: FakeTypingRecord[] = [];

  private readonly redis?: Redis;
  private readonly logger: Logger;
  private counter = 0;

  constructor(opts: FakeMessagingProviderOptions = {}) {
    this.phoneNumber = opts.phoneNumber ?? DEFAULT_PHONE_NUMBER;
    this.redis = opts.redis;
    this.logger = opts.logger ?? createLogger({ name: 'fake-messaging-provider' });
  }

  /** Unique across processes and restarts: outbound ids are stored under a unique index. */
  private nextId(): string {
    this.counter += 1;
    return `fake-${this.counter}-${randomUUID().slice(0, 8)}`;
  }

  private async record(to: string, body: string, mediaUrl: string | null, kind: FakeSentKind): Promise<SendResult> {
    const record: FakeSentRecord = { id: this.nextId(), to, body, mediaUrl, kind, at: new Date() };
    this.sent.push(record);
    this.logger.info({ to, kind, providerMessageId: record.id }, 'fake: message sent');

    if (this.redis) {
      const stored: FakeStoredSent = { ...record, at: record.at.toISOString() };
      const key = `fakephone:sent:${to}`;
      await this.redis.lpush(key, JSON.stringify(stored));
      await this.redis.ltrim(key, 0, MAX_RECENT_SENT - 1);
    }
    return { providerMessageId: record.id, status: 'delivered' };
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    return this.record(msg.to, msg.body, null, 'text');
  }

  async sendMedia(msg: OutboundMedia): Promise<SendResult> {
    return this.record(msg.to, msg.body, msg.mediaUrl, 'media');
  }

  async sendContactCard(to: string, vcard: string): Promise<SendResult> {
    return this.record(to, vcard, null, 'vcard');
  }

  async react(params: { to: string; targetProviderMessageId: string; reaction: Tapback }): Promise<void> {
    this.reactions.push({ ...params, at: new Date() });
  }

  async typing(to: string): Promise<void> {
    this.typingEvents.push({ to, at: new Date() });
    if (this.redis) {
      await this.redis.set(`fakephone:typing:${to}`, '1', 'EX', TYPING_TTL_SECONDS);
    }
  }

  /** Whether `to` currently shows the typing bubble (Redis-backed when configured, else in-memory). */
  async getTypingState(to: string): Promise<boolean> {
    if (this.redis) {
      const v = await this.redis.get(`fakephone:typing:${to}`);
      return v !== null;
    }
    const last = [...this.typingEvents].reverse().find((t) => t.to === to);
    if (!last) return false;
    return Date.now() - last.at.getTime() < TYPING_TTL_SECONDS * 1000;
  }

  /** Most recent `n` messages sent to `to`, newest first. */
  async recentSent(to: string, n: number): Promise<FakeSentRecord[]> {
    if (this.redis) {
      const raw = await this.redis.lrange(`fakephone:sent:${to}`, 0, n - 1);
      return raw.map((r) => {
        const stored = JSON.parse(r) as FakeStoredSent;
        return { ...stored, at: new Date(stored.at) };
      });
    }
    return this.sent
      .filter((s) => s.to === to)
      .slice(-n)
      .reverse();
  }

  verifySignature(req: WebhookRequest): boolean {
    const header = req.headers['x-fake-signature'];
    const value = Array.isArray(header) ? header[0] : header;
    return value === 'fake';
  }

  parseInboundWebhook(req: WebhookRequest): InboundEvent[] {
    const peek = FakeInboundKindPeekSchema.safeParse(req.body);
    if (!peek.success) {
      this.logger.warn({ issues: peek.error.issues }, 'fake: unrecognized webhook payload');
      return [];
    }
    const kind = peek.data.kind ?? 'message';

    if (kind === 'status') {
      const parsed = FakeInboundStatusBodySchema.safeParse(req.body);
      if (!parsed.success) {
        this.logger.warn({ issues: parsed.error.issues }, 'fake: unrecognized status webhook payload');
        return [];
      }
      const event: DeliveryStatusEvent = {
        kind: 'status',
        providerMessageId: parsed.data.providerMessageId,
        status: parsed.data.status,
        error: parsed.data.error ?? null,
        at: new Date(),
      };
      return [event];
    }

    if (kind === 'reaction') {
      const parsed = FakeInboundReactionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        this.logger.warn({ issues: parsed.error.issues }, 'fake: unrecognized reaction webhook payload');
        return [];
      }
      const event: ReactionEvent = {
        kind: 'reaction',
        providerMessageId: `fake-reaction-${randomUUID()}`,
        from: parsed.data.from,
        reaction: parsed.data.reaction,
        targetProviderMessageId: parsed.data.targetProviderMessageId,
        at: new Date(),
      };
      return [event];
    }

    const parsed = FakeInboundMessageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      this.logger.warn({ issues: parsed.error.issues }, 'fake: unrecognized message webhook payload');
      return [];
    }
    const event: InboundMessageEvent = {
      kind: 'message',
      providerMessageId: parsed.data.providerMessageId ?? `fake-in-${randomUUID()}`,
      from: parsed.data.from,
      to: parsed.data.to ?? this.phoneNumber,
      body: parsed.data.body,
      mediaUrls: parsed.data.mediaUrls ?? [],
      receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
    };
    return [event];
  }

  /** Builds a `WebhookRequest` for an inbound text, for tests and the `/dev/phone` page. */
  static buildInboundRequest(input: {
    from: string;
    to?: string;
    body: string;
    mediaUrls?: string[];
    providerMessageId?: string;
  }): WebhookRequest {
    const payload = {
      from: input.from,
      to: input.to,
      body: input.body,
      mediaUrls: input.mediaUrls,
      providerMessageId: input.providerMessageId,
    };
    return {
      headers: { 'x-fake-signature': 'fake', 'content-type': 'application/json' },
      rawBody: JSON.stringify(payload),
      body: payload,
      query: {},
    };
  }
}
