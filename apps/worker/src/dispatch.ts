/**
 * Single entry point every job runs through: validates the raw payload against `JobPayloads[name]`
 * and routes to the handler. The BullMQ processors in `src/index.ts` call this, and so do the
 * tests — handlers are exercised without Redis or a running queue.
 */
import { JobPayloads, type JobName, type JobPayload } from '@apogee/shared/jobs';
import { runCheckRecommenders } from './jobs/browser/recommenders';
import { runFillFields } from './jobs/browser/fill';
import { runFullSync } from './jobs/browser/sync';
import { runVerifyCredentials } from './jobs/browser/verify';
import {
  runDocumentExtractionJob,
  runEssayFeedbackJob,
  runInboundMessage,
  runNarrativeSummaryJob,
  runProactiveRun,
  runReminderDraftJob,
  runSyncFollowupJob,
  runWeeklyPlanJob,
  runWelcomeJob,
} from './jobs/agent';
import { runDeleteAccount, runDisconnectCommonApp, runExportData, runFirstPlan, runRecomputeNextActions } from './jobs/maintenance';
import { runTick } from './scheduler/tick';
import type { WorkerDeps } from './deps';

type Handler<N extends JobName> = (deps: WorkerDeps, payload: JobPayload<N>) => Promise<unknown>;
type Handlers = { [N in JobName]: Handler<N> };

const handlers: Handlers = {
  'browser.verify_credentials': runVerifyCredentials,
  'browser.full_sync': runFullSync,
  'browser.fill_fields': runFillFields,
  'browser.check_recommenders': runCheckRecommenders,

  'agent.inbound_message': runInboundMessage,
  'agent.proactive_run': runProactiveRun,
  'agent.sync_followup': runSyncFollowupJob,
  'agent.essay_feedback': runEssayFeedbackJob,
  'agent.document_extraction': runDocumentExtractionJob,
  'agent.weekly_plan': runWeeklyPlanJob,
  'agent.reminder_draft': runReminderDraftJob,
  'agent.welcome': runWelcomeJob,
  'agent.narrative_summary': runNarrativeSummaryJob,

  'scheduler.tick': (deps) => runTick(deps),

  'maintenance.recompute_next_actions': runRecomputeNextActions,
  'maintenance.disconnect_commonapp': runDisconnectCommonApp,
  'maintenance.delete_account': runDeleteAccount,
  'maintenance.export_data': runExportData,
  'maintenance.first_plan': runFirstPlan,
};

/** Validates `payload` against `JobPayloads[name]` and runs the matching handler. */
export async function dispatch<N extends JobName>(deps: WorkerDeps, name: N, payload: unknown): Promise<unknown> {
  const parsed = JobPayloads[name].parse(payload) as JobPayload<N>;
  const handler = handlers[name];
  return handler(deps, parsed);
}
