/** `browser.verify_credentials`: login only, to confirm freshly-entered Common App credentials
 * work. On success, texts once and kicks off a full sync so the student sees real data quickly. */
import { appendAudit, browserJobsRepo, conversationsRepo, messagesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import { jobIds, type JobPayload } from '@tbd/shared/jobs';
import { BrowserJobResult } from '@tbd/shared/schemas';
import type { WorkerDeps } from '../../deps';
import { runBrowserJob } from './lifecycle';
import { loginForJob } from './login';

export async function runVerifyCredentials(deps: WorkerDeps, payload: JobPayload<'browser.verify_credentials'>): Promise<BrowserJobResult> {
  return runBrowserJob(deps, { browserJobId: payload.browserJobId, studentId: payload.studentId, kind: 'verify_credentials' }, async (session) => {
    const login = await loginForJob(deps, session, payload.studentId, payload.browserJobId);
    const sdb = scoped(deps.db, payload.studentId);

    const student = await studentsRepo.findById(deps.db, payload.studentId);
    if (student?.phoneE164) {
      const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
      const text = "You're connected — I can see your Common App now.";
      const sent = await deps.messaging.send({ to: student.phoneE164, body: text });
      const row = await messagesRepo.append(sdb, {
        conversationId: conversation.id,
        channel: 'imessage',
        direction: 'outbound',
        body: text,
        providerMessageId: sent.providerMessageId,
        deliveryStatus: sent.status,
      });
      await appendAudit(sdb, { actor: 'system', action: 'verify.connected', entityType: 'message', entityId: row.id });
    }

    const syncJob = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: deps.sessions.provider });
    await deps.enqueuer.enqueue(
      'browser.full_sync',
      { studentId: payload.studentId, browserJobId: syncJob.id, reason: 'verification' },
      { jobId: jobIds.sync(payload.studentId, `verify-${payload.browserJobId}`) },
    );

    return BrowserJobResult.parse({
      pages_visited: ['login'],
      login_ok: true,
      verification_requested: login.verificationRequested,
      notes: 'Credentials verified.',
    });
  });
}
