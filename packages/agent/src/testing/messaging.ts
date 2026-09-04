import type { InboundEvent, MessagingProvider, OutboundMedia, OutboundMessage, SendResult, Tapback, WebhookRequest } from '@tbd/shared/adapters';

export interface RecordedReaction {
  to: string;
  targetProviderMessageId: string;
  reaction: Tapback;
}

/** In-memory `MessagingProvider` for tests: records everything sent instead of calling a vendor. */
export class InMemoryMessagingProvider implements MessagingProvider {
  readonly name = 'fake' as const;
  readonly phoneNumber: string;
  readonly sent: OutboundMessage[] = [];
  readonly media: OutboundMedia[] = [];
  readonly reactions: RecordedReaction[] = [];
  readonly typingCalls: string[] = [];
  readonly contactCards: Array<{ to: string; vcard: string }> = [];
  private counter = 0;

  constructor(phoneNumber = '+15555550100') {
    this.phoneNumber = phoneNumber;
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    this.sent.push(msg);
    this.counter++;
    return { providerMessageId: `fake-msg-${this.counter}`, status: 'sent' };
  }

  async sendMedia(msg: OutboundMedia): Promise<SendResult> {
    this.media.push(msg);
    this.counter++;
    return { providerMessageId: `fake-media-${this.counter}`, status: 'sent' };
  }

  async react(params: { to: string; targetProviderMessageId: string; reaction: Tapback }): Promise<void> {
    this.reactions.push(params);
  }

  async typing(to: string): Promise<void> {
    this.typingCalls.push(to);
  }

  async sendContactCard(to: string, vcard: string): Promise<SendResult> {
    this.contactCards.push({ to, vcard });
    this.counter++;
    return { providerMessageId: `fake-vcard-${this.counter}`, status: 'sent' };
  }

  verifySignature(_req: WebhookRequest): boolean {
    return true;
  }

  parseInboundWebhook(_req: WebhookRequest): InboundEvent[] {
    return [];
  }
}
