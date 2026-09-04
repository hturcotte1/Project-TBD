/**
 * `POST /documents` — multipart upload, registered by hand (it isn't in the contract because it
 * takes a file, not JSON) but behind the same `authenticate` preHandler as every other route.
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { DOCUMENT_KINDS, type DocumentKind } from '@tbd/shared/domain';
import { jobIds } from '@tbd/shared/jobs';
import { mapDocument } from '../mappers';
import type { ApiDeps } from '../deps';
import type { AuthVerifier } from '../auth/verifier';
import { createAuthenticate } from '../auth/authenticate';
import { sendError } from '../errors';

const MAX_BYTES = 20 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export function registerDocumentUpload(app: FastifyInstance, deps: ApiDeps, verifier: AuthVerifier): void {
  const authenticate = createAuthenticate(deps, verifier);

  app.route({
    method: 'POST',
    url: '/documents',
    preHandler: [authenticate],
    handler: async (req, reply) => {
      if (!req.auth) return sendError(reply, 401, 'unauthorized', 'missing bearer token');
      if (!req.isMultipart()) return sendError(reply, 400, 'validation_error', 'expected multipart/form-data');

      const file = await req.file({ limits: { fileSize: MAX_BYTES } });
      if (!file) return sendError(reply, 400, 'validation_error', 'missing file field "file"');

      const kindField = file.fields.kind;
      const kindValue = kindField && !Array.isArray(kindField) && kindField.type === 'field' ? String(kindField.value) : null;
      if (!kindValue || !(DOCUMENT_KINDS as readonly string[]).includes(kindValue)) {
        return sendError(reply, 400, 'validation_error', `field "kind" must be one of ${DOCUMENT_KINDS.join(', ')}`);
      }
      const kind = kindValue as DocumentKind;

      const ext = EXT_BY_MIME[file.mimetype];
      if (!ext) return sendError(reply, 400, 'validation_error', `unsupported content type "${file.mimetype}"`);

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch {
        return sendError(reply, 400, 'validation_error', `file exceeds the ${MAX_BYTES} byte limit`);
      }
      if (buffer.byteLength > MAX_BYTES) return sendError(reply, 400, 'validation_error', `file exceeds the ${MAX_BYTES} byte limit`);

      const studentId = req.auth.studentId;
      const storageKey = `${studentId}/documents/${randomUUID()}.${ext}`;
      await deps.storage.put(storageKey, buffer, file.mimetype);

      const sdb = scoped(deps.db, studentId);
      const [row] = await sdb.insert(S.documents, {
        kind,
        source: 'dashboard',
        filename: file.filename,
        contentType: file.mimetype,
        sizeBytes: buffer.byteLength,
        storageKey,
        extractionStatus: 'pending',
      });
      if (!row) return sendError(reply, 500, 'internal_error', 'failed to save document');

      await deps.enqueuer.enqueue('agent.document_extraction', { studentId, documentId: row.id }, { jobId: jobIds.extraction(row.id) });

      const dto = await mapDocument(row, deps.storage);
      return reply.code(201).send(dto);
    },
  });
}
