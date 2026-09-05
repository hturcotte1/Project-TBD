import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { appendAudit, browserJobsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { defineTool, fail, ok } from './types';

export const AnswerVerificationCodeInput = z.object({ code: z.string().regex(/^\d{4,8}$/, 'expected a numeric code') });

export const answerVerificationCodeTool = defineTool({
  name: 'answerVerificationCode',
  description: 'Pass a verification code the student just texted along to the browser job that is waiting for it.',
  inputSchema: AnswerVerificationCodeInput,
  authorization: 'student_text',
  async run(tc, input) {
    // Never log or persist the code itself. The student's own text carried it, so scrub it from
    // the stored inbound message whether or not a job is waiting.
    if (tc.run.inboundMessageId) {
      const [msg] = await tc.sdb.select(S.messages, eq(S.messages.id, tc.run.inboundMessageId), { limit: 1 });
      if (msg && msg.body.includes(input.code)) {
        await tc.sdb.update(S.messages, { body: msg.body.split(input.code).join('[verification code]') }, eq(S.messages.id, msg.id));
      }
    }
    const job = tc.ctx.awaitingVerificationJob ?? (await browserJobsRepo.awaitingVerification(tc.sdb));
    if (!job) return fail("I'm not waiting on a verification code right now.");
    await tc.deps.codeChannel.publish(job.id, input.code);
    await appendAudit(tc.sdb, { actor: 'agent', action: 'verification_code.received', entityType: 'browser_job', entityId: job.id });
    return ok({ browserJobId: job.id }, 'Got it — sending that through now.');
  },
});
