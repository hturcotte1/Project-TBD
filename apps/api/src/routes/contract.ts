/**
 * Registers every route in the shared API contract. `registerContract` iterates `Object.entries(api)`
 * so a missing entry in `handlers` is a compile error (the `{ [K in RouteKey]: RouteHandler<K> }`
 * type below), parses params/query/body with the contract's zod (400 on failure), and validates the
 * response with `def.response.parse` before sending it (500 + a logged error on mismatch) — this is
 * what guarantees the contract end to end.
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { scoped, type StudentDb } from '@apogee/shared/db';
import { api, type RouteKey, type RouteResponse, type RouteDef } from '@apogee/shared/api';
import { type z } from 'zod';
import type { AuthContext } from '../auth/authenticate';
import { createAuthenticate, requireAdmin } from '../auth/authenticate';
import type { ApiDeps } from '../deps';
import type { AuthVerifier } from '../auth/verifier';
import { sendError } from '../errors';

export interface HandlerArgs<K extends RouteKey> {
  params: z.infer<(typeof api)[K]['params']>;
  query: z.infer<(typeof api)[K]['query']>;
  body: z.infer<(typeof api)[K]['body']>;
  /** null only for `auth: 'public'` routes (just `health`). */
  auth: AuthContext | null;
  sdb: StudentDb | null;
  deps: ApiDeps;
  requestId: string;
  reply: FastifyReply;
}

export type RouteHandler<K extends RouteKey> = (args: HandlerArgs<K>) => Promise<RouteResponse<K>>;

export interface AuthedHandlerArgs<K extends RouteKey> extends HandlerArgs<K> {
  auth: AuthContext;
  sdb: StudentDb;
}

/** Wraps a handler that requires auth (every route except `health`) so it gets non-null `auth`/`sdb`. */
export function authed<K extends RouteKey>(fn: (args: AuthedHandlerArgs<K>) => Promise<RouteResponse<K>>): RouteHandler<K> {
  return async (args) => {
    if (!args.auth || !args.sdb) throw new Error(`route requires authentication but none was attached`);
    return fn(args as AuthedHandlerArgs<K>);
  };
}

export type Handlers = { [K in RouteKey]: RouteHandler<K> };

function requestIdOf(req: { headers: Record<string, unknown>; id: string }): string {
  const header = req.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.length > 0 ? value : req.id;
}

export function registerContract(app: FastifyInstance, deps: ApiDeps, verifier: AuthVerifier, handlers: Handlers): void {
  const authenticate = createAuthenticate(deps, verifier);

  for (const key of Object.keys(api) as RouteKey[]) {
    const def = api[key] as RouteDef;
    const handler = handlers[key] as unknown as (args: HandlerArgs<RouteKey>) => Promise<unknown>;
    const preHandler = def.auth === 'public' ? [] : def.auth === 'admin' ? [authenticate, requireAdmin] : [authenticate];

    app.route({
      method: def.method,
      url: def.path,
      preHandler,
      handler: async (req, reply) => {
        const requestId = requestIdOf(req);

        const paramsResult = def.params.safeParse(req.params ?? {});
        if (!paramsResult.success) return sendError(reply, 400, 'validation_error', 'invalid path params', paramsResult.error.issues);
        const queryResult = def.query.safeParse(req.query ?? {});
        if (!queryResult.success) return sendError(reply, 400, 'validation_error', 'invalid query', queryResult.error.issues);
        const bodyResult = def.body.safeParse(req.body ?? {});
        if (!bodyResult.success) return sendError(reply, 400, 'validation_error', 'invalid body', bodyResult.error.issues);

        const auth = req.auth ?? null;
        const sdb = auth ? scoped(deps.db, auth.studentId) : null;

        const result = await handler({
          params: paramsResult.data,
          query: queryResult.data,
          body: bodyResult.data,
          auth,
          sdb,
          deps,
          requestId,
          reply,
        });
        if (reply.sent) return;

        const validated = def.response.safeParse(result);
        if (!validated.success) {
          deps.logger.error({ route: key, issues: validated.error.issues }, 'response failed contract validation');
          return sendError(reply, 500, 'internal_error', 'response contract violation');
        }

        if (key === 'timelineIcs') {
          reply.header('content-type', 'text/calendar; charset=utf-8');
          return reply.send(validated.data);
        }
        return reply.send(validated.data);
      },
    });
  }
}
