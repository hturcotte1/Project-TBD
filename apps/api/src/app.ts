/**
 * `buildApp(deps)`: the Fastify instance with every plugin, every route, and the error handler
 * that guarantees a consistent `{ code, message, details }` shape (matching `ApiError` in
 * `@apogee/shared/api/client`) for every failure.
 */
import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import rawBody from 'fastify-raw-body';
import { ZodError } from 'zod';
import { AuthorizationError } from '@apogee/shared/db';
import { DuplicateApplicationError, InvalidSchoolInputError } from '@apogee/shared/services';
import { buildAuthVerifier } from './auth/verifier';
import type { ApiDeps } from './deps';
import { HttpError, sendError } from './errors';
import { registerPublicRoutes } from './public';
import { registerApiRoutes } from './routes';
import { registerDevPhone } from './devphone';
import { registerSendblueWebhook } from './webhooks/sendblue';

const MAX_BODY_BYTES = 25 * 1024 * 1024;

export function buildApp(deps: ApiDeps): FastifyInstance {
  const app: FastifyInstance = Fastify({
    loggerInstance: deps.logger as unknown as FastifyBaseLogger,
    bodyLimit: MAX_BODY_BYTES,
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      const value = Array.isArray(header) ? header[0] : header;
      return value && value.length > 0 ? value : randomUUID();
    },
  });

  app.register(cors, { origin: deps.env.APP_URL, credentials: true });
  app.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute' });
  app.register(multipart, { limits: { fileSize: MAX_BODY_BYTES } });
  app.register(formbody);
  app.register(rawBody, { field: 'rawBody', global: false, runFirst: true, encoding: 'utf8' });

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof HttpError) return sendError(reply, err.status, err.code, err.message, err.details);
    if (err instanceof AuthorizationError) return sendError(reply, 404, 'not_found', 'not found');
    if (err instanceof DuplicateApplicationError) return sendError(reply, 409, 'already_exists', err.message);
    if (err instanceof InvalidSchoolInputError) return sendError(reply, 400, 'validation_error', err.message);
    if (err instanceof ZodError) return sendError(reply, 400, 'validation_error', 'invalid request', err.issues);

    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return sendError(reply, status, (err as { code?: string }).code ?? 'error', err.message);
    }

    req.log.error({ err, route: req.routeOptions?.url }, 'unhandled error');
    return sendError(reply, 500, 'internal_error', 'internal server error');
  });

  app.setNotFoundHandler((_req, reply) => sendError(reply, 404, 'not_found', 'not found'));

  const verifier = buildAuthVerifier(deps.env, deps.logger);
  registerApiRoutes(app, deps, verifier);
  registerSendblueWebhook(app, deps);
  registerDevPhone(app, deps);
  registerPublicRoutes(app, deps);

  return app;
}
