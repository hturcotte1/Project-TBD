/** `browser.fill_fields`: the level-B writer. Fills exactly the approved payload, verifies it
 * stuck by re-reading the page, and never runs a submit/pay action — the runtime guard inside
 * `@apogee/browser` throws `SubmitGuardError` on any such attempt, which fails the job for good. */
import { eq } from 'drizzle-orm';
import { SubmitGuardError } from '@apogee/browser';
import { UnrecoverableError } from 'bullmq';
import { appendAudit, conversationsRepo, messagesRepo, scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { summarizeFillPayload } from '@apogee/shared/domain';
import type { JobPayload } from '@apogee/shared/jobs';
import { BrowserJobResult, FillFieldsPayload } from '@apogee/shared/schemas';
import type { WorkerDeps } from '../../deps';
import { runBrowserJob } from './lifecycle';
import { loginForJob } from './login';

export async function runFillFields(deps: WorkerDeps, payload: JobPayload<'browser.fill_fields'>): Promise<BrowserJobResult> {
  return runBrowserJob(deps, { browserJobId: payload.browserJobId, studentId: payload.studentId, kind: 'fill_fields' }, async (session, hooks) => {
    const sdb = scoped(deps.db, payload.studentId);
    const approval = await sdb.selectOne(S.approvals, eq(S.approvals.id, payload.approvalId));
    const parsedPayload = approval && approval.status === 'approved' && approval.payload.kind === 'fill_fields' ? FillFieldsPayload.safeParse(approval.payload) : null;

    if (!approval || approval.status !== 'approved' || approval.payload.kind !== 'fill_fields' || !parsedPayload?.success) {
      await appendAudit(sdb, {
        actor: 'system',
        action: 'fill.invalid_approval',
        entityType: 'approval',
        entityId: payload.approvalId,
        details: { status: approval?.status ?? null, kind: approval?.payload.kind ?? null },
      });
      throw new UnrecoverableError(`approval ${payload.approvalId} is not an approved fill_fields payload`);
    }
    const fillPayload = parsedPayload.data;

    await loginForJob(deps, session, payload.studentId, payload.browserJobId);

    let result: Awaited<ReturnType<typeof deps.browser.fillFields>>;
    try {
      result = await deps.browser.fillFields(session, fillPayload, hooks);
    } catch (err) {
      if (err instanceof SubmitGuardError) {
        await sdb.update(S.approvals, { status: 'failed' }, eq(S.approvals.id, approval.id));
        await appendAudit(sdb, {
          actor: 'system',
          action: 'fill.blocked_by_guard',
          entityType: 'approval',
          entityId: approval.id,
          details: { message: err.message, matched: err.matched },
        });
        throw new UnrecoverableError(err.message);
      }
      throw err;
    }

    const screenshotKeys = hooks.screenshots.map((s) => s.storage_key);
    await sdb.update(S.approvals, { status: result.ok ? 'executed' : 'failed', resultingJobId: payload.browserJobId }, eq(S.approvals.id, approval.id));
    await appendAudit(sdb, {
      actor: 'system',
      action: result.ok ? 'fill.completed' : 'fill.failed',
      entityType: 'approval',
      entityId: approval.id,
      details: { verifications: result.verifications, screenshot_keys: screenshotKeys },
    });

    if (result.ok) {
      const student = await studentsRepo.findById(deps.db, payload.studentId);
      if (student?.phoneE164) {
        const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
        const text = `Done — I filled ${summarizeFillPayload(fillPayload)}. Screenshot's on your dashboard.`;
        const sent = await deps.messaging.send({ to: student.phoneE164, body: text });
        await messagesRepo.append(sdb, {
          conversationId: conversation.id,
          channel: 'imessage',
          direction: 'outbound',
          body: text,
          providerMessageId: sent.providerMessageId,
          deliveryStatus: sent.status,
        });
        const lastKey = screenshotKeys[screenshotKeys.length - 1];
        if (lastKey) {
          try {
            const url = await deps.storage.getUrl(lastKey);
            await deps.messaging.sendMedia({ to: student.phoneE164, body: '', mediaUrl: url });
          } catch (err) {
            deps.logger.warn({ err: err instanceof Error ? err.message : String(err), browserJobId: payload.browserJobId }, 'fill.screenshot_media_failed');
          }
        }
      }
    }

    return BrowserJobResult.parse({
      pages_visited: hooks.screenshots.map((s) => s.page),
      login_ok: true,
      fill_verifications: result.verifications,
      notes: result.ok ? 'Fill completed and verified.' : 'Fill completed with unverified fields.',
    });
  });
}
