import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type {
  DeliveryStatusEvent,
  InboundEvent,
  InboundMessageEvent,
  MessagingProvider,
  OutboundMedia,
  OutboundMessage,
  SendResult,
  Tapback,
  WebhookRequest,
} from '@apogee/shared/adapters';
import type { DeliveryStatus } from '@apogee/shared/domain';
import { createLogger, type Logger } from '@apogee/shared/logging';
import { MessagingError } from './errors';

const DEFAULT_BASE_URL = 'https://api.sendblue.com';
const RETRY_BACKOFF_MS = 250;
const MAX_ERROR_BODY_CHARS = 500;

export interface SendblueConfig {
  apiKeyId: string;
  apiSecretKey: string;
  /** The Sendblue-provisioned number students text; sent as `from_number` on every send. */
  phoneNumber: string;
  /** Shared secret configured on the account's webhooks; null disables signature checking. */
  webhookSecret: string | null;
  /** Passed as `status_callback` on every send so Sendblue posts delivery updates back to us. */
  statusCallbackUrl: string | null;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /**
   * When true, `verifySignature` accepts unsigned requests while `webhookSecret` is null.
   * Only for local testing against a real Sendblue account with no secret configured yet.
   * Defaults to false (fail closed) so production never silently accepts unverified webhooks.
   */
  allowUnsigned?: boolean;
  logger?: Logger;
}

/**
 * Sendblue's documented statuses (see the Sending Messages guide's "Message Status Resolution"
 * table): REGISTERED/PENDING/QUEUED/ACCEPTED precede send, SENT/DELIVERED are the iMessage
 * terminal states, DECLINED/ERROR are failures. READ is not part of the documented set of
 * status-callback values, but is accepted defensively since the contract's DeliveryStatus
 * includes it and Sendblue does report read receipts elsewhere in its API.
 */
const STATUS_MAP: Record<string, DeliveryStatus> = {
  REGISTERED: 'queued',
  PENDING: 'queued',
  QUEUED: 'queued',
  ACCEPTED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  DECLINED: 'failed',
  ERROR: 'failed',
};

function mapDeliveryStatus(status: string, logger: Logger): DeliveryStatus {
  const mapped = STATUS_MAP[status.toUpperCase()];
  if (!mapped) {
    logger.warn({ status }, 'sendblue: unrecognized message status, defaulting to queued');
    return 'queued';
  }
  return mapped;
}

/** Response body of `POST /api/send-message` (and, structurally, `/api/send-reaction`, `/api/send-typing-indicator`). */
const SendMessageResponseSchema = z
  .object({
    message_handle: z.string().min(1).optional(),
    status: z.string().optional(),
    error_message: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Sendblue posts one JSON object per event to the `receive` webhook (inbound messages) and to a
 * message's `status_callback` (outbound status updates). Every field beyond the ones we read is
 * accepted and ignored via `.passthrough()` so additive fields never break parsing.
 */
const SendblueWebhookEventSchema = z
  .object({
    content: z.string().nullable().optional(),
    is_outbound: z.boolean().nullable().optional(),
    status: z.string().min(1),
    error_message: z.string().nullable().optional(),
    message_handle: z.string().min(1),
    date_sent: z.string().nullable().optional(),
    date_updated: z.string().nullable().optional(),
    from_number: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    to_number: z.string().nullable().optional(),
    media_url: z.string().nullable().optional(),
  })
  .passthrough();

type SendblueWebhookEvent = z.infer<typeof SendblueWebhookEventSchema>;

function parseDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toInboundEvent(evt: SendblueWebhookEvent, logger: Logger): InboundEvent {
  const isInboundMessage = evt.status.toUpperCase() === 'RECEIVED' && evt.is_outbound !== true;
  if (isInboundMessage) {
    const inbound: InboundMessageEvent = {
      kind: 'message',
      providerMessageId: evt.message_handle,
      from: evt.from_number ?? evt.number ?? '',
      to: evt.to_number ?? '',
      body: evt.content ?? '',
      mediaUrls: evt.media_url ? [evt.media_url] : [],
      receivedAt: parseDate(evt.date_sent),
    };
    return inbound;
  }
  const status: DeliveryStatusEvent = {
    kind: 'status',
    providerMessageId: evt.message_handle,
    status: mapDeliveryStatus(evt.status, logger),
    error: evt.error_message ?? null,
    at: parseDate(evt.date_updated ?? evt.date_sent),
  };
  return status;
}

function getHeader(headers: WebhookRequest['headers'], name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value[0];
    return value;
  }
  return undefined;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still perform a constant-time comparison of equal length to avoid a length-based timing
    // side-channel; the result is discarded since the lengths already prove a mismatch.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Real iMessage transport via Sendblue's REST API (https://docs.sendblue.com), verified against
 * the live docs on 2026-09-04. Every endpoint below (send-message, send-typing-indicator,
 * send-reaction, and the inbound/status webhook payload shapes) was confirmed against the
 * current documentation; the one gap the docs leave unstated is called out on `verifySignature`.
 */
export class SendblueProvider implements MessagingProvider {
  readonly name = 'sendblue' as const;
  readonly phoneNumber: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;

  constructor(private readonly config: SendblueConfig) {
    this.phoneNumber = config.phoneNumber;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.logger = config.logger ?? createLogger({ name: 'sendblue-provider' });
  }

  private async request(path: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'content-type': 'application/json',
      'sb-api-key-id': this.config.apiKeyId,
      'sb-api-secret-key': this.config.apiSecretKey,
    };
    const payload = JSON.stringify(body);

    let res = await this.fetchImpl(url, { method: 'POST', headers, body: payload });
    if (!res.ok && isRetryableStatus(res.status)) {
      this.logger.warn({ path, status: res.status }, 'sendblue: request failed, retrying once');
      await sleep(RETRY_BACKOFF_MS);
      res = await this.fetchImpl(url, { method: 'POST', headers, body: payload });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn({ path, status: res.status }, 'sendblue: request failed');
      throw new MessagingError({
        status: res.status,
        body: text.slice(0, MAX_ERROR_BODY_CHARS),
        retryable: isRetryableStatus(res.status),
      });
    }
    return res.json();
  }

  private toSendResult(raw: unknown): SendResult {
    const parsed = SendMessageResponseSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.message_handle) {
      this.logger.warn({ issues: parsed.success ? undefined : parsed.error.issues }, 'sendblue: unexpected send response shape');
      throw new MessagingError({ status: 502, body: 'unexpected response shape from sendblue', retryable: false });
    }
    return {
      providerMessageId: parsed.data.message_handle,
      status: mapDeliveryStatus(parsed.data.status ?? 'QUEUED', this.logger),
    };
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    const body: Record<string, unknown> = {
      from_number: this.phoneNumber,
      number: msg.to,
      content: msg.body,
    };
    if (this.config.statusCallbackUrl) body.status_callback = this.config.statusCallbackUrl;
    return this.toSendResult(await this.request('/api/send-message', body));
  }

  async sendMedia(msg: OutboundMedia): Promise<SendResult> {
    const body: Record<string, unknown> = {
      from_number: this.phoneNumber,
      number: msg.to,
      media_url: msg.mediaUrl,
    };
    if (msg.body) body.content = msg.body;
    if (this.config.statusCallbackUrl) body.status_callback = this.config.statusCallbackUrl;
    return this.toSendResult(await this.request('/api/send-message', body));
  }

  /**
   * Sendblue has no vCard/contact-card upload endpoint (its "Contact Sharing" API is Apple's
   * Name & Photo Sharing feature, unrelated to VCF files). A vCard can only be delivered as a
   * media attachment, and `media_url` must be a URL Sendblue can fetch — so the caller must
   * host the vCard and pass its URL; we cannot embed the vCard text as a `data:` URL because
   * Sendblue only supports `media_url` fetched over HTTP(S).
   */
  async sendContactCard(to: string, vcard: string): Promise<SendResult> {
    const trimmed = vcard.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new Error('vCard must be hosted; pass a URL');
    }
    return this.sendMedia({ to, body: '', mediaUrl: trimmed });
  }

  async typing(to: string): Promise<void> {
    await this.request('/api/send-typing-indicator', {
      number: to,
      from_number: this.phoneNumber,
      state: 'start',
    });
  }

  /**
   * Sendblue documents `POST /api/send-reaction` for classic tapbacks (love/like/dislike/laugh/
   * emphasize/question, matching the shared `Tapback` type exactly) as well as arbitrary emoji.
   * `to` isn't sent: reactions attach to an existing message via `message_handle` and the
   * sending line (`from_number`), not a fresh recipient number.
   */
  async react(params: { to: string; targetProviderMessageId: string; reaction: Tapback }): Promise<void> {
    await this.request('/api/send-reaction', {
      from_number: this.phoneNumber,
      message_handle: params.targetProviderMessageId,
      reaction: params.reaction,
    });
  }

  /**
   * Sendblue's webhook guide (docs.sendblue.com/getting-started/webhooks) states that a
   * configured per-webhook `secret` or account-wide `globalSecret` is "included in the webhook
   * request headers" but — as of the 2026-09-04 docs snapshot — never names the literal header.
   * This implements the task's documented fallback: a shared secret carried in the
   * `sb-signing-secret` header, or a `secret` query parameter, compared timing-safely. Confirm
   * the real header name against a live webhook delivery before relying on this in production.
   */
  verifySignature(req: WebhookRequest): boolean {
    if (!this.config.webhookSecret) return this.config.allowUnsigned ?? false;
    const candidate = getHeader(req.headers, 'sb-signing-secret') ?? req.query['secret'];
    if (!candidate) return false;
    return timingSafeEqualString(candidate, this.config.webhookSecret);
  }

  parseInboundWebhook(req: WebhookRequest): InboundEvent[] {
    const parsed = SendblueWebhookEventSchema.safeParse(req.body);
    if (!parsed.success) {
      this.logger.warn({ issues: parsed.error.issues }, 'sendblue: unrecognized webhook payload');
      return [];
    }
    return [toInboundEvent(parsed.data, this.logger)];
  }
}
