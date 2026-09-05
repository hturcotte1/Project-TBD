/** `POST /webhooks/sendblue` — signature-checked, idempotent inbound webhook. */
import type { FastifyInstance } from 'fastify';
import type { WebhookRequest } from '@apogee/shared/adapters';
import type { ApiDeps } from '../deps';
import { sendError } from '../errors';
import { handleInboundEvents } from './inbound';

function toWebhookRequest(req: { headers: Record<string, string | string[] | undefined>; rawBody?: string | Buffer; body: unknown; query: unknown }): WebhookRequest {
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : (req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {}));
  return { headers: req.headers, rawBody, body: req.body, query: (req.query ?? {}) as Record<string, string | undefined> };
}

export function registerSendblueWebhook(app: FastifyInstance, deps: ApiDeps): void {
  app.route({
    method: 'POST',
    url: '/webhooks/sendblue',
    config: { rawBody: true, rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const webhookReq = toWebhookRequest(req);
      if (!deps.messaging.verifySignature(webhookReq)) {
        return sendError(reply, 401, 'unauthorized', 'invalid webhook signature');
      }
      const events = deps.messaging.parseInboundWebhook(webhookReq);
      await handleInboundEvents(deps, deps.messaging.name, events);
      return reply.code(200).send({ ok: true });
    },
  });
}
