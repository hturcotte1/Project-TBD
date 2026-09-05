/**
 * Shared lifecycle for every browser job: mark running, open a session (resuming a stored cookie
 * jar when we have one), run the caller's work, persist the `BrowserJobResult`, close the
 * session, and audit the outcome. `kind`-specific logic (login, capture, fill) lives in the
 * sibling files; this file only owns bookkeeping every job kind shares.
 */
import { eq } from 'drizzle-orm';
import type { CaptureHooks, BrowserSessionHandle } from '@apogee/browser';
import { appendAudit, browserJobsRepo, credentialsRepo, scoped } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import type { BrowserJobKind } from '@apogee/shared/domain';
import type { BrowserJobResult, ScreenshotRef } from '@apogee/shared/schemas';
import type { WorkerDeps } from '../../deps';

/** Hooks handed to a job's work function: the same `onPage` screenshot hook `@apogee/browser` calls,
 * plus a live view of every screenshot taken so far this job (for confirmation media, audit, ...). */
export interface JobHooks extends CaptureHooks {
  readonly screenshots: ScreenshotRef[];
}

export interface BrowserJobRef {
  browserJobId: string;
  studentId: string;
  kind: BrowserJobKind;
}

export type BrowserJobWork = (session: BrowserSessionHandle, hooks: JobHooks) => Promise<BrowserJobResult>;

/** Runs one browser job end-to-end. `work` throws to fail the job (a `bullmq.UnrecoverableError`
 * disables the automatic retry); this function always marks the row, closes the session, and
 * records the audit entry, then rethrows so the queue processor sees the failure. */
export async function runBrowserJob(deps: WorkerDeps, ref: BrowserJobRef, work: BrowserJobWork): Promise<BrowserJobResult> {
  const sdb = scoped(deps.db, ref.studentId);
  const current = await sdb.requireOne(S.browserJobs, eq(S.browserJobs.id, ref.browserJobId));
  await browserJobsRepo.update(sdb, ref.browserJobId, { status: 'running', startedAt: deps.clock.now(), attempts: current.attempts + 1 });

  const stored = await credentialsRepo.decryptForWorker(sdb, deps.keyRing, 'common_app');
  const session = await deps.sessions.open({ studentId: ref.studentId, storageStateJson: stored?.session ?? null });
  await browserJobsRepo.update(sdb, ref.browserJobId, { providerSessionId: session.id, replayUrl: session.replayUrl });

  const screenshots: ScreenshotRef[] = [];
  const hooks: JobHooks = {
    screenshots,
    onPage: async (name, _html, png) => {
      // `name` can carry a per-college id after a colon (e.g. "college_questions:umich"); storage
      // keys allow only [A-Za-z0-9_-./], so the key uses a sanitized form while `page` keeps the
      // original semantic name.
      const safeName = name.replace(/[^A-Za-z0-9_.-]/g, '_');
      const key = `${ref.studentId}/screenshots/${ref.browserJobId}/${safeName}.png`;
      await deps.storage.put(key, png, 'image/png');
      screenshots.push({ page: name, storage_key: key, taken_at: deps.clock.now().toISOString() });
      await browserJobsRepo.update(sdb, ref.browserJobId, { screenshots: [...screenshots] });
    },
  };

  let outcome: 'succeeded' | 'failed' = 'succeeded';
  let errorMessage: string | null = null;
  let result: BrowserJobResult | null = null;
  try {
    result = await work(session, hooks);
    return result;
  } catch (err) {
    outcome = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await session.close().catch((closeErr: unknown) => {
      deps.logger.warn(
        { browserJobId: ref.browserJobId, studentId: ref.studentId, err: closeErr instanceof Error ? closeErr.message : String(closeErr) },
        'browser session close failed',
      );
    });
    const set: Partial<S.NewBrowserJob> = { status: outcome, error: errorMessage, finishedAt: deps.clock.now() };
    if (result) set.result = result;
    await browserJobsRepo.update(sdb, ref.browserJobId, set);
    await appendAudit(sdb, {
      actor: 'system',
      action: `browser_job.${ref.kind}.${outcome}`,
      entityType: 'browser_job',
      entityId: ref.browserJobId,
      details: { attempts: current.attempts + 1 },
    });
    deps.logger.info({ browserJobId: ref.browserJobId, studentId: ref.studentId, kind: ref.kind, outcome }, 'browser_job.finished');
  }
}
