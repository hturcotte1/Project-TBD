/**
 * The inbound-event pipeline shared by the real Sendblue webhook and the `/dev/phone` composer:
 * both build `InboundEvent[]` and hand them to `handleInboundEvents`, so there is exactly one
 * code path that turns an inbound text/media/status/reaction into rows and an enqueued job.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DeliveryStatusEvent, InboundEvent, InboundMessageEvent, ReactionEvent } from '@tbd/shared/adapters';
import { conversationsRepo, messagesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { jobIds } from '@tbd/shared/jobs';
import { normalizePhone } from '@tbd/messaging';
import type { MediaRef } from '@tbd/shared/schemas';
import type { ApiDeps } from '../deps';
import { EXT_BY_MIME, MAX_UPLOAD_BYTES } from '../util/mime';

async function downloadMedia(deps: ApiDeps, studentId: string, url: string): Promise<MediaRef | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_UPLOAD_BYTES) return null;
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

  const phone = normalizePhone(event.from);
  const student = phone ? await studentsRepo.findByPhone(deps.db, phone) : null;
  if (!student) {
    deps.logger.warn({ from: event.from }, 'inbound: message from unknown phone number');
    return;
  }

  const media: MediaRef[] = [];
  for (const url of event.mediaUrls) {
    const ref = await downloadMedia(deps, student.id, url);
    if (ref) media.push(ref);
  }

  const sdb = scoped(deps.db, student.id);
  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  const message = await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'inbound',
    kind: media.length > 0 && event.body.trim().length === 0 ? 'media' : 'text',
    body: event.body,
    media,
    providerMessageId: event.providerMessageId,
  });

  await deps.enqueuer.enqueue('agent.inbound_message', { studentId: student.id, messageId: message.id, conversationKind: 'main' }, { jobId: jobIds.inbound(message.id) });
}

async function handleStatusEvent(deps: ApiDeps, event: DeliveryStatusEvent): Promise<void> {
  const message = await messagesRepo.byProviderId(deps.db, event.providerMessageId);
  if (!message) return;
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
