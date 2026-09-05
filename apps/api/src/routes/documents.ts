import { desc, eq } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { AuthorizationError } from '@apogee/shared/db';
import type { Academics, TestScores } from '@apogee/shared/schemas';
import { jobIds } from '@apogee/shared/jobs';
import { mapActivity, mapDocument, mapProfile } from '../mappers';
import { ensureProfile, replaceActivities } from './profileUtil';
import { authed, type Handlers } from './contract';

function mergePartial<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const merged = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

export const documentHandlers: Pick<
  Handlers,
  'documentsList' | 'documentGet' | 'documentExtract' | 'documentApplyTranscript' | 'documentApplyActivities' | 'documentDelete'
> = {
  documentsList: authed(async ({ sdb, query, deps }) => {
    const rows = await sdb.select(S.documents, query.kind ? eq(S.documents.kind, query.kind) : undefined, { orderBy: desc(S.documents.createdAt) });
    return Promise.all(rows.map((r) => mapDocument(r, deps.storage)));
  }),

  documentGet: authed(async ({ sdb, params, deps }) => {
    const row = await sdb.requireOne(S.documents, eq(S.documents.id, params.id));
    return mapDocument(row, deps.storage);
  }),

  documentExtract: authed(async ({ sdb, params, auth, deps }) => {
    const row = await sdb.requireOne(S.documents, eq(S.documents.id, params.id));
    const [updated] = await sdb.update(S.documents, { extractionStatus: 'pending', extractionError: null }, eq(S.documents.id, row.id));
    if (!updated) throw new Error('failed to queue extraction');
    await deps.enqueuer.enqueue('agent.document_extraction', { studentId: auth.studentId, documentId: row.id }, { jobId: jobIds.extraction(row.id) });
    return mapDocument(updated, deps.storage);
  }),

  documentApplyTranscript: authed(async ({ sdb, body }) => {
    const existing = await sdb.selectOne(S.studentProfiles);
    const baseAcademics: Academics = existing?.academics ?? { gpa_weighted: null, gpa_unweighted: null, gpa_scale: null, class_rank: null, class_size: null, rigor_summary: '', senior_courses: [] };
    const baseTestScores: TestScores = existing?.testScores ?? { sat: [], act: [], ap: [], ib: [], test_optional_stance: 'undecided' };
    const academics = mergePartial(baseAcademics, body.academics);
    const testScores = body.test_scores ? mergePartial(baseTestScores, body.test_scores) : baseTestScores;
    const updated = await ensureProfile(sdb, { academics, testScores });
    return mapProfile(updated);
  }),

  documentApplyActivities: authed(async ({ sdb, body }) => {
    const rows = await replaceActivities(sdb, body.activities);
    return rows.sort((a, b) => a.position - b.position).map(mapActivity);
  }),

  documentDelete: authed(async ({ sdb, params, deps }) => {
    const row = await sdb.selectOne(S.documents, eq(S.documents.id, params.id));
    if (!row) throw new AuthorizationError();
    await deps.storage.delete(row.storageKey);
    await sdb.delete(S.documents, eq(S.documents.id, params.id));
    return { ok: true };
  }),
};
