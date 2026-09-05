/**
 * `/dev/phone`: a fake iMessage thread for local development, only mounted when
 * `MESSAGING_PROVIDER=fake`. `/dev/storage/*` (local disk objects) is separate and gated on
 * `STORAGE_PROVIDER=local`. Both are unauthenticated dev-only routes — never mounted in a real
 * deployment where MESSAGING_PROVIDER/STORAGE_PROVIDER point at real vendors.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FakeMessagingProvider } from '@tbd/messaging';
import { normalizePhone } from '@tbd/messaging';
import { conversationsRepo, messagesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import { DEMO_STUDENT } from '@tbd/shared/seed';
import { mapMessage } from '../mappers';
import type { ApiDeps } from '../deps';
import { sendError } from '../errors';
import { EXT_BY_MIME, MAX_UPLOAD_BYTES } from '../util/mime';
import { handleInboundEvents } from '../webhooks/inbound';
import { renderDevPhonePage } from './page';

const SendBody = z.object({ phone: z.string().min(1), body: z.string().default(''), mediaUrls: z.array(z.string()).default([]) });

export function registerDevPhone(app: FastifyInstance, deps: ApiDeps): void {
  const production = deps.env.NODE_ENV === 'production';
  if (production && (deps.env.MESSAGING_PROVIDER === 'fake' || deps.env.STORAGE_PROVIDER === 'local')) {
    deps.logger.warn('dev-only providers configured in production; /dev routes stay disabled');
  }
  if (!production && deps.env.MESSAGING_PROVIDER === 'fake') {
    app.get('/dev/phone', async (req, reply) => {
      const query = req.query as { phone?: string };
      reply.header('content-type', 'text/html; charset=utf-8');
      return reply.send(renderDevPhonePage(query.phone ?? DEMO_STUDENT.phoneE164));
    });

    app.get('/dev/phone/state', async (req, reply) => {
      const query = req.query as { phone?: string };
      const phone = normalizePhone(query.phone ?? '') ?? DEMO_STUDENT.phoneE164;
      const student = await studentsRepo.findByPhone(deps.db, phone);
      const agentName = deps.env.AGENT_NAME;
      const agentPhone = deps.messaging.phoneNumber;
      if (!student) return reply.send({ messages: [], typing: false, agentName, agentPhone });

      const sdb = scoped(deps.db, student.id);
      const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
      const rows = await messagesRepo.recent(sdb, conversation.id, 200);
      const messages = rows.filter((r) => r.channel === 'imessage').map((r) => mapMessage(r, 'main'));
      const typing = deps.messaging instanceof FakeMessagingProvider ? await deps.messaging.getTypingState(phone) : false;
      return reply.send({ messages, typing, agentName, agentPhone });
    });

    app.route({
      method: 'POST',
      url: '/dev/phone/send',
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      handler: async (req, reply) => {
        const parsed = SendBody.safeParse(req.body);
        if (!parsed.success) return sendError(reply, 400, 'validation_error', 'invalid body', parsed.error.issues);
        const phone = normalizePhone(parsed.data.phone) ?? parsed.data.phone;
        const webhookReq = FakeMessagingProvider.buildInboundRequest({ from: phone, body: parsed.data.body, mediaUrls: parsed.data.mediaUrls });
        const events = deps.messaging.parseInboundWebhook(webhookReq);
        await handleInboundEvents(deps, deps.messaging.name, events);
        return reply.send({ ok: true });
      },
    });

    app.route({
      method: 'POST',
      url: '/dev/phone/upload',
      handler: async (req, reply) => {
        if (!req.isMultipart()) return sendError(reply, 400, 'validation_error', 'expected multipart/form-data');
        const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
        if (!file) return sendError(reply, 400, 'validation_error', 'missing file field "file"');
        const ext = EXT_BY_MIME[file.mimetype] ?? 'bin';
        const buf = await file.toBuffer();
        const key = `dev-phone-uploads/${randomUUID()}.${ext}`;
        await deps.storage.put(key, buf, file.mimetype);
        const url = await deps.storage.getUrl(key);
        return reply.send({ url });
      },
    });
  }

  if (!production && deps.env.STORAGE_PROVIDER === 'local') {
    app.get('/dev/storage/*', async (req, reply) => {
      const key = (req.params as Record<string, string>)['*'];
      if (!key) return sendError(reply, 404, 'not_found', 'not found');
      const obj = await deps.storage.get(key);
      if (!obj) return sendError(reply, 404, 'not_found', 'not found');
      reply.header('content-type', obj.contentType);
      return reply.send(obj.body);
    });
  }
}
