import { z } from 'zod';
import { appendAudit, browserJobsRepo } from '@apogee/shared/db';
import { jobIds } from '@apogee/shared/jobs';
import { defineTool, ok } from './types';

export const RequestSyncInput = z.object({});

export const requestSyncTool = defineTool({
  name: 'requestSync',
  description: 'Trigger a fresh Common App sync right now instead of waiting for the scheduled one.',
  inputSchema: RequestSyncInput,
  authorization: 'student_text',
  async run(tc) {
    const provider = tc.deps.env.BROWSER_PROVIDER === 'browserbase' ? 'browserbase' : 'local';
    const job = await browserJobsRepo.create(tc.sdb, { kind: 'full_sync', provider });
    await tc.deps.enqueuer.enqueue(
      'browser.full_sync',
      { studentId: tc.studentId, browserJobId: job.id, reason: 'agent_request' },
      { jobId: jobIds.sync(tc.studentId, `manual-${tc.run.id}`) },
    );
    await appendAudit(tc.sdb, { actor: 'agent', action: 'sync.requested', entityType: 'browser_job', entityId: job.id });
    return ok({ browserJobId: job.id }, "On it — checking Common App now. I'll text you if anything changed.");
  },
});
