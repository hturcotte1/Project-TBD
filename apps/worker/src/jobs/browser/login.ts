/**
 * Logs a browser job into Common App: decrypts stored credentials, drives `@tbd/browser`'s
 * `login()`, and implements the verification-code pause/resume state machine (DECISIONS.md #8) —
 * the job moves to `awaiting_verification_code`, texts the student once, and waits on the
 * `VerificationCodeChannel` for up to `deps.verificationTimeoutMs`. On success the session's
 * cookies are re-encrypted and stored so the next job can skip straight to a remembered device.
 */
import { UnrecoverableError } from 'bullmq';
import type { BrowserSessionHandle } from '@tbd/browser';
import { appendAudit, browserJobsRepo, conversationsRepo, credentialsRepo, messagesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import type { WorkerDeps } from '../../deps';

export interface LoginForJobResult {
  ok: true;
  verificationRequested: boolean;
}

const VERIFICATION_REQUESTED_TEXT = "Common App just sent you a code — text it back to me and I'll keep going.";
const VERIFICATION_TIMEOUT_TEXT = "I didn't get the code in time — text me 'sync' whenever you're ready and I'll try again.";
const VERIFICATION_REJECTED_TEXT = "That code didn't work — text me 'sync' whenever you're ready and I'll try again.";

/** Sends one text and records it as an outbound message + audit entry. No-op when the student has no phone. */
async function texted(deps: WorkerDeps, studentId: string, body: string, auditAction: string): Promise<void> {
  const sdb = scoped(deps.db, studentId);
  const student = await studentsRepo.findById(deps.db, studentId);
  if (!student?.phoneE164) return;
  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  const sent = await deps.messaging.send({ to: student.phoneE164, body });
  const row = await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    body,
    providerMessageId: sent.providerMessageId,
    deliveryStatus: sent.status,
  });
  await appendAudit(sdb, { actor: 'system', action: auditAction, entityType: 'message', entityId: row.id });
}

/** Logs a session into Common App for one browser job. Returns on success; throws (an
 * `UnrecoverableError` when retrying would not help) on every failure path. */
export async function loginForJob(deps: WorkerDeps, session: BrowserSessionHandle, studentId: string, browserJobId: string): Promise<LoginForJobResult> {
  const sdb = scoped(deps.db, studentId);
  const stored = await credentialsRepo.decryptForWorker(sdb, deps.keyRing, 'common_app');
  if (!stored) throw new UnrecoverableError('no credentials on file for common_app');

  let verificationRequested = false;
  const result = await deps.browser.login(session, { username: stored.username, secret: stored.secret }, {
    onVerificationCodeRequired: async () => {
      verificationRequested = true;
      await import('@tbd/shared/db').then(({ browserJobsRepo }) => browserJobsRepo.update(sdb, browserJobId, { status: 'awaiting_verification_code' }));
      await texted(deps, studentId, VERIFICATION_REQUESTED_TEXT, 'verification.requested');
      const code = await deps.codeChannel.waitFor(browserJobId, deps.verificationTimeoutMs);
      if (code !== null) {
        const { browserJobsRepo } = await import('@tbd/shared/db');
        await browserJobsRepo.update(sdb, browserJobId, { status: 'running' });
      }
      return code;
    },
  });

  if (result.ok) {
    await credentialsRepo.storeSession(sdb, deps.keyRing, 'common_app', await session.storageState());
    await credentialsRepo.markVerified(sdb, 'common_app');
    return { ok: true, verificationRequested };
  }

  switch (result.reason) {
    case 'invalid_credentials':
      await credentialsRepo.recordFailure(sdb, 'common_app', true);
      throw new UnrecoverableError(`common app login rejected: ${result.detail}`);
    case 'verification_required_timeout':
      await texted(deps, studentId, VERIFICATION_TIMEOUT_TEXT, 'verification.timed_out');
      throw new UnrecoverableError(`verification code not received in time: ${result.detail}`);
    case 'verification_code_rejected':
      await texted(deps, studentId, VERIFICATION_REJECTED_TEXT, 'verification.rejected');
      throw new UnrecoverableError(`verification code rejected: ${result.detail}`);
    case 'maintenance':
      throw new Error(`common app is in maintenance: ${result.detail}`);
    case 'unknown':
      throw new Error(`common app login failed: ${result.detail}`);
  }
}
