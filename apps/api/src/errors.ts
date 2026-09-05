/** Shared error response shape (matches `ApiError` in `@apogee/shared/api/client`) and small helpers
 * for route handlers that need to fail with a specific HTTP status/code without throwing. */
import type { FastifyReply } from 'fastify';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

/** Thrown by route handlers to fail a request with a specific status/code; caught by the app's
 * error handler and turned into `{ code, message, details }`. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function sendError(reply: FastifyReply, status: number, code: string, message: string, details?: unknown): FastifyReply {
  const body: ApiErrorBody = details === undefined ? { code, message } : { code, message, details };
  return reply.code(status).send(body);
}
