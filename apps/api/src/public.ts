/** `GET /public/agent.vcf` — the agent's contact card, publicly fetchable (no auth). */
import type { FastifyInstance } from 'fastify';
import { buildVCard } from '@tbd/messaging';
import type { ApiDeps } from './deps';

export function registerPublicRoutes(app: FastifyInstance, deps: ApiDeps): void {
  app.get('/public/agent.vcf', async (_req, reply) => {
    const vcard = buildVCard({ firstName: deps.env.AGENT_NAME, phone: deps.messaging.phoneNumber, url: deps.env.APP_URL, org: 'College application agent' });
    reply.header('content-type', 'text/vcard; charset=utf-8');
    return reply.send(vcard);
  });
}
