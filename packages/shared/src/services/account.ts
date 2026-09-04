/**
 * Account-level operations that don't belong to any one student-scoped table: hard-deleting a
 * student (storage + row, cascading every owned table), and disconnecting Common App credentials.
 */
import { eq } from 'drizzle-orm';
import * as S from '../db/schema';
import { appendAudit, browserJobsRepo, credentialsRepo } from '../db/repos/core';
import type { StudentDb } from '../db/repos/scoped';
import type { DbOrTx } from '../db/client';
import type { StorageProvider } from '../adapters/storage';
import type { JobEnqueuer } from '../jobs/definitions';
import { jobIds } from '../jobs/definitions';

/** Hard-deletes a student: storage objects, then the row (every owned table cascades). No audit
 * entry can carry a student id afterward, so it is recorded with `studentId: null`. */
export async function deleteAccount(db: DbOrTx, studentId: string, storage: StorageProvider): Promise<void> {
  await storage.deletePrefix(`${studentId}/`);
  await db.delete(S.students).where(eq(S.students.id, studentId));
  await db.insert(S.auditLog).values({
    studentId: null,
    actor: 'system',
    action: 'account.deleted',
    entityType: 'student',
    entityId: studentId,
    details: {},
  });
}

/** Disconnects Common App: deletes the stored credentials, cancels queued browser jobs (DB rows
 * and enqueued jobs), and clears any sync-paused reason so the student can reconnect cleanly. */
export async function disconnectCommonApp(sdb: StudentDb, enqueuer: JobEnqueuer): Promise<void> {
  await credentialsRepo.remove(sdb, 'common_app');
  await browserJobsRepo.cancelQueued(sdb);
  await enqueuer.cancelByPrefix('browser', jobIds.browserPrefix(sdb.studentId));
  await sdb.db.update(S.students).set({ syncPausedReason: null }).where(eq(S.students.id, sdb.studentId));
  await appendAudit(sdb, { actor: 'student', action: 'credentials.disconnected', entityType: 'credential', details: { provider: 'common_app' } });
}
