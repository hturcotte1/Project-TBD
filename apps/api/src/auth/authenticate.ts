/**
 * `authenticate` preHandler: verifies the bearer token, upserts the student row, and attaches
 * `req.auth`. `requireAdmin` is a second preHandler for `auth: 'admin'` routes.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { studentsRepo } from '@tbd/shared/db';
import type { Role } from '@tbd/shared/domain';
import type { ApiDeps } from '../deps';
import type { AuthVerifier } from './verifier';

export interface AuthContext {
  studentId: string;
  role: Role;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

export function createAuthenticate(deps: ApiDeps, verifier: AuthVerifier) {
  return async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = bearerToken(req);
    if (!token) {
      await reply.code(401).send({ code: 'unauthorized', message: 'missing bearer token' });
      return;
    }
    const verified = await verifier.verify(token);
    if (!verified) {
      await reply.code(401).send({ code: 'unauthorized', message: 'invalid token' });
      return;
    }
    const isAdmin = deps.env.ADMIN_EMAILS.includes(verified.email.toLowerCase());
    const student = await studentsRepo.upsertFromAuth(deps.db, { authUserId: verified.authUserId, email: verified.email, isAdmin });
    if (student.status === 'deleted') {
      await reply.code(401).send({ code: 'unauthorized', message: 'account deleted' });
      return;
    }
    req.auth = { studentId: student.id, role: student.role, email: student.email };
  };
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.auth?.role !== 'admin') {
    await reply.code(403).send({ code: 'forbidden', message: 'admin only' });
  }
}
