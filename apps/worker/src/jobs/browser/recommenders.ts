/** `browser.check_recommenders`: a lighter sync — full capture (the client has no cheaper partial
 * capture), but only recommenders/assignments and the `teacher_rec`/`counselor_rec` items get
 * updated. No new `common_app_snapshots` row, no application status/deadline change. */
import { scoped, studentsRepo } from '@apogee/shared/db';
import type { JobPayload } from '@apogee/shared/jobs';
import { BrowserJobResult } from '@apogee/shared/schemas';
import { applyRecommenderUpdates } from '@apogee/shared/services';
import { localDate } from '@apogee/shared/time';
import type { WorkerDeps } from '../../deps';
import { runBrowserJob } from './lifecycle';
import { loginForJob } from './login';

export async function runCheckRecommenders(deps: WorkerDeps, payload: JobPayload<'browser.check_recommenders'>): Promise<BrowserJobResult> {
  return runBrowserJob(deps, { browserJobId: payload.browserJobId, studentId: payload.studentId, kind: 'check_recommenders' }, async (session, hooks) => {
    const login = await loginForJob(deps, session, payload.studentId, payload.browserJobId);
    const capture = await deps.browser.captureSnapshot(session, hooks);

    const student = await studentsRepo.findById(deps.db, payload.studentId);
    const today = localDate(deps.clock.now(), student?.timezone ?? 'America/New_York');

    const applied = await deps.db.transaction(async (tx) => {
      const txSdb = scoped(tx, payload.studentId);
      return applyRecommenderUpdates(tx, txSdb, { snapshot: capture.normalized, today });
    });

    return BrowserJobResult.parse({
      pages_visited: capture.pagesVisited,
      login_ok: true,
      verification_requested: login.verificationRequested,
      notes: `Recommender check: ${applied.applicationsChecked} application(s), ${applied.itemsChanged} item(s) changed.`,
    });
  });
}
