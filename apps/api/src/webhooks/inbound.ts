/**
 * The inbound-event pipeline shared by the real Sendblue webhook and the `/dev/phone` composer:
 * both build `InboundEvent[]` and hand them to `handleInboundEvents`, so there is exactly one
 * code path that turns an inbound text/media/status/reaction into rows and an enqueued job.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DeliveryStatusEvent, InboundEvent, InboundMessageEvent, ReactionEvent } from '@apogee/shared/adapters';
import { conversationsRepo, messagesRepo, scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { jobIds } from '@apogee/shared/jobs';
import { normalizePhone } from '@apogee/messaging';
import type { MediaRef } from '@apogee/shared/schemas';
import type { ApiDeps } from '../deps';
import { EXT_BY_MIME, MAX_UPLOAD_BYTES } from '../util/mime';

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|\[?fc|\[?fd|172\.(1[6-9]|2\d|3[01])\.)/i;

/** Only fetch media from public HTTPS hosts (HTTP and local hosts are allowed outside production, for the fake provider). */
export function isAllowedMediaUrl(url: string, production: boolean): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (production) return parsed.protocol === 'https:' && !PRIVATE_HOST.test(host) && !host.endsWith('.internal') && !host.endsWith('.local');
  return parsed.protocol === 'https:' || parsed.protocol === 'http:';
}

/** Reads a response body with a hard byte cap, aborting the fetch instead of buffering an oversized file. */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function downloadMedia(deps: ApiDeps, studentId: string, url: string): Promise<MediaRef | null> {
  try {
    if (!isAllowedMediaUrl(url, deps.env.NODE_ENV === 'production')) {
      deps.logger.warn({ url }, 'inbound: media url rejected');
      return null;
    }
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = await readCapped(res, MAX_UPLOAD_BYTES);
    if (!buf || buf.byteLength === 0) return null;
    const contentType = (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]!.trim();
    const ext = EXT_BY_MIME[contentType];
    const filename = `${randomUUID()}${ext ? `.${ext}` : ''}`;
    const key = `${studentId}/inbound/${filename}`;
    await deps.storage.put(key, buf, contentType);

    const sdb = scoped(deps.db, studentId);
    const [doc] = await sdb.insert(S.documents, {
      kind: 'photo',
      source: 'imessage',
      filename,
      contentType,
      sizeBytes: buf.byteLength,
      storageKey: key,
      extractionStatus: 'pending',
    });
    if (!doc) return null;
    return { storage_key: key, content_type: contentType, document_id: doc.id, url: await deps.storage.getUrl(key), filename };
  } catch (err) {
    deps.logger.warn({ err, url }, 'inbound: media download failed');
    return null;
  }
}

async function handleMessageEvent(deps: ApiDeps, provider: string, event: InboundMessageEvent): Promise<void> {
  const [webhookRow] = await deps.db
    .insert(S.webhookEvents)
    .values({ provider, providerEventId: event.providerMessageId, payload: { from: event.from, hasBody: event.body.length > 0, mediaCount: event.mediaUrls.length } })
    .onConflictDoNothing()
    .returning();
  if (!webhookRow) {
    deps.logger.info({ providerMessageId: event.providerMessageId }, 'inbound: duplicate message event');
    return;
  }

  try {
    const phone = normalizePhone(event.from);
    const student = phone ? await studentsRepo.findByPhone(deps.db, phone) : null;
    if (!student) {
      // Not silently dropped: admins can see unknown senders in the audit feed (number masked).
      deps.logger.warn({ from: maskPhone(event.from) }, 'inbound: message from unknown phone number');
      await deps.db.insert(S.auditLog).values({
        studentId: null,
        actor: 'system',
        action: 'inbound.unknown_phone',
        details: { from: maskPhone(event.from), providerMessageId: event.providerMessageId, mediaCount: event.mediaUrls.length },
      });
      return;
    }

    const media: MediaRef[] = [];
    for (const url of event.mediaUrls) {
      const ref = await downloadMedia(deps, student.id, url);
      if (ref) media.push(ref);
    }

    const sdb = scoped(deps.db, student.id);
    const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
    // A retry after a failed attempt may find the message already stored: reuse it rather than duplicate it.
    const existing = await messagesRepo.byProviderId(deps.db, event.providerMessageId);
    const message =
      existing && existing.studentId === student.id
        ? existing
        : await messagesRepo.append(sdb, {
            conversationId: conversation.id,
            channel: 'imessage',
            direction: 'inbound',
            kind: media.length > 0 && event.body.trim().length === 0 ? 'media' : 'text',
            body: event.body,
            media,
            providerMessageId: event.providerMessageId,
          });

    await deps.enqueuer.enqueue('agent.inbound_message', { studentId: student.id, messageId: message.id, conversationKind: 'main' }, { jobId: jobIds.inbound(message.id) });
  } catch (err) {
    // The idempotency marker must not survive a failed attempt, or the provider's retry would be treated as a duplicate.
    await deps.db.delete(S.webhookEvents).where(eq(S.webhookEvents.id, webhookRow.id));
    throw err;
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 4 ? `***${digits.slice(-4)}` : '***';
}

const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

async function handleStatusEvent(deps: ApiDeps, event: DeliveryStatusEvent): Promise<void> {
  const message = await messagesRepo.byProviderId(deps.db, event.providerMessageId);
  if (!message) return;
  // Delivery status only moves forward; a late "sent" after "delivered" is ignored.
  if ((STATUS_RANK[event.status] ?? 0) < (STATUS_RANK[message.deliveryStatus] ?? 0)) return;
  const sdb = scoped(deps.db, message.studentId);
  const set: Partial<S.NewMessage> = { deliveryStatus: event.status };
  if (event.status === 'delivered') set.deliveredAt = event.at;
  if (event.status === 'read') set.readAt = event.at;
  await sdb.update(S.messages, set, eq(S.messages.id, message.id));
}

async function handleReactionEvent(deps: ApiDeps, event: ReactionEvent): Promise<void> {
  const phone = normalizePhone(event.from);
  const student = phone ? await studentsRepo.findByPhone(deps.db, phone) : null;
  if (!student) {
    deps.logger.warn({ from: event.from }, 'inbound: reaction from unknown phone number');
    return;
  }
  const target = event.targetProviderMessageId ? await messagesRepo.byProviderId(deps.db, event.targetProviderMessageId) : null;
  const sdb = scoped(deps.db, student.id);
  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'inbound',
    kind: 'reaction',
    body: '',
    reaction: event.reaction,
    inReplyToId: target?.id ?? null,
    providerMessageId: event.providerMessageId,
  });
}

/** Runs every inbound event through the exact same pipeline, whichever transport produced it. */
export async function handleInboundEvents(deps: ApiDeps, provider: string, events: InboundEvent[]): Promise<void> {
  for (const event of events) {
    if (event.kind === 'message') await handleMessageEvent(deps, provider, event);
    else if (event.kind === 'status') await handleStatusEvent(deps, event);
    else if (event.kind === 'reaction') await handleReactionEvent(deps, event);
  }
}
