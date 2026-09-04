import type { DeliveryStatus } from '../domain/enums';

export interface OutboundMessage {
  /** E.164 phone number. */
  to: string;
  body: string;
}

export interface OutboundMedia extends OutboundMessage {
  /** Publicly fetchable (or signed) URL the provider can download. */
  mediaUrl: string;
}

export interface SendResult {
  providerMessageId: string;
  status: DeliveryStatus;
}

export type Tapback = 'love' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question';

export interface InboundMessageEvent {
  kind: 'message';
  providerMessageId: string;
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  receivedAt: Date;
}
export interface DeliveryStatusEvent {
  kind: 'status';
  providerMessageId: string;
  status: DeliveryStatus;
  error: string | null;
  at: Date;
}
export interface ReactionEvent {
  kind: 'reaction';
  providerMessageId: string;
  from: string;
  reaction: string;
  targetProviderMessageId: string | null;
  at: Date;
}
export type InboundEvent = InboundMessageEvent | DeliveryStatusEvent | ReactionEvent;

/** Raw webhook request as received by the API. */
export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  body: unknown;
  query: Record<string, string | undefined>;
}

/**
 * iMessage transport. Business logic never touches a vendor SDK; it calls this.
 * Real: SendblueProvider. Local: FakeMessagingProvider (+ /dev/phone).
 */
export interface MessagingProvider {
  readonly name: 'sendblue' | 'fake';
  /** The number students text. */
  readonly phoneNumber: string;
  send(msg: OutboundMessage): Promise<SendResult>;
  sendMedia(msg: OutboundMedia): Promise<SendResult>;
  react(params: { to: string; targetProviderMessageId: string; reaction: Tapback }): Promise<void>;
  typing(to: string): Promise<void>;
  sendContactCard(to: string, vcard: string): Promise<SendResult>;
  verifySignature(req: WebhookRequest): boolean;
  parseInboundWebhook(req: WebhookRequest): InboundEvent[];
}
