import { z } from 'zod';
import { appendAudit, browserJobsRepo } from '@tbd/shared/db';
import { defineTool, fail, ok } from './types';

export const AnswerVerificationCodeInput = z.object({ code: z.string().regex(/^\d{4,8}$/, 'expected a numeric code') });

export const answerVerificationCodeTool = defineTool({
  name: 'answerVerificationCode',
  description: 'Pass a verification code the student just texted along to the browser job that is waiting for it.',
  inputSchema: AnswerVerificationCodeInput,
  authorization: 'student_text',
  async run(tc, input) {
    const job = tc.ctx.awaitingVerificationJob ?? (await browserJobsRepo.awaitingVerification(tc.sdb));
    if (!job) return fail("I'm not waiting on a verification code right now.");
    await tc.deps.codeChannel.publish(job.id, input.code);
    // Never log or persist the code itself — only that one arrived.
    await appendAudit(tc.sdb, { actor: 'agent', action: 'verification_code.received', entityType: 'browser_job', entityId: job.id });
    return ok({ browserJobId: job.id }, 'Got it — sending that through now.');
  },
});
