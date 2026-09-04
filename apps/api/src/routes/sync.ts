import { eq } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { appendAudit, browserJobsRepo, credentialsRepo, studentsRepo, AuthorizationError } from '@tbd/shared/db';
import { disconnectCommonApp } from '@tbd/shared/services';
import { jobIds } from '@tbd/shared/jobs';
import { parseKeyRing } from '@tbd/shared/crypto';
import { mapBrowserJob, mapCredentialStatus } from '../mappers';
import { HttpError } from '../errors';
import { authed, type Handlers } from './contract';

export const syncHandlers: Pick<
  Handlers,
  'syncStatus' | 'syncRun' | 'credentialsConnectCommonApp' | 'credentialsDisconnectCommonApp' | 'verificationCodeSubmit'
> = {
  syncStatus: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const [lastSyncJob, lastJob, awaitingJob, credStatus] = await Promise.all([
      browserJobsRepo.latest(sdb, 'full_sync'),
      browserJobsRepo.latest(sdb),
      browserJobsRepo.awaitingVerification(sdb),
      credentialsRepo.status(sdb, 'common_app'),
    ]);
    return {
      last_synced_at: lastSyncJob?.finishedAt ? lastSyncJob.finishedAt.toISOString() : null,
      last_job: lastJob ? await mapBrowserJob(lastJob, deps.storage) : null,
      awaiting_verification_job_id: awaitingJob?.id ?? null,
      credentials: mapCredentialStatus('common_app', credStatus),
      sync_paused_reason: student.syncPausedReason,
    };
  }),

  syncRun: authed(async ({ auth, sdb, deps }) => {
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: deps.env.BROWSER_PROVIDER });
    await deps.enqueuer.enqueue(
      'browser.full_sync',
      { studentId: auth.studentId, browserJobId: job.id, reason: 'manual' },
      { jobId: jobIds.sync(auth.studentId, `manual-${job.id}`) },
    );
    return mapBrowserJob(job, deps.storage);
  }),

  credentialsConnectCommonApp: authed(async ({ auth, sdb, deps, body, requestId }) => {
    const ring = parseKeyRing(deps.env.CREDENTIALS_ENCRYPTION_KEYS, deps.env.CREDENTIALS_ENCRYPTION_KEY_VERSION);
    await credentialsRepo.store(sdb, ring, 'common_app', body.email, body.password);
    await sdb.db.update(S.students).set({ syncPausedReason: null }).where(eq(S.students.id, auth.studentId));

    const job = await browserJobsRepo.create(sdb, { kind: 'verify_credentials', provider: deps.env.BROWSER_PROVIDER });
    await deps.enqueuer.enqueue('browser.verify_credentials', { studentId: auth.studentId, browserJobId: job.id }, { jobId: jobIds.verify(job.id) });
    await appendAudit(sdb, { actor: 'student', action: 'credentials.connected', entityType: 'credential', details: { provider: 'common_app' }, requestId });
    return mapBrowserJob(job, deps.storage);
  }),

  credentialsDisconnectCommonApp: authed(async ({ sdb, deps }) => {
    await disconnectCommonApp(sdb, deps.enqueuer);
    return { ok: true };
  }),

  verificationCodeSubmit: authed(async ({ sdb, deps, body }) => {
    const job = await browserJobsRepo.awaitingVerification(sdb);
    if (!job) throw new HttpError(409, 'no_job_waiting', 'No browser job is currently waiting for a verification code.');
    await deps.codeChannel.publish(job.id, body.code);
    return { ok: true };
  }),
};
