import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit, approvalsRepo, browserJobsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { buildActivitiesFillPayload, buildPersonalEssayFillPayload, buildProfileFillPayload, summarizeFillPayload } from '@apogee/shared/domain';
import type { FillFieldsPayload } from '@apogee/shared/schemas';
import { jobIds } from '@apogee/shared/jobs';
import { defineTool, fail, ok } from './types';

export const ProposeFillFieldsInput = z.object({
  section: z.enum(['activities', 'college_questions', 'personal_essay', 'profile']),
  school: z.string().min(1).max(200).optional(),
});

export const proposeFillFieldsTool = defineTool({
  name: 'proposeFillFields',
  description: "Propose filling a Common App section from the student's own saved data. Creates a pending approval; nothing is filled until the student says yes.",
  inputSchema: ProposeFillFieldsInput,
  authorization: 'student_text',
  async run(tc, input) {
    let payload: FillFieldsPayload;
    if (input.section === 'activities') {
      const activities = await tc.sdb.select(S.activities, undefined, { orderBy: asc(S.activities.position) });
      if (activities.length === 0) return fail("You don't have any activities entered yet — add some first.");
      payload = buildActivitiesFillPayload(activities);
    } else if (input.section === 'profile') {
      if (!tc.ctx.profile) return fail("Your profile isn't filled in yet.");
      payload = buildProfileFillPayload(tc.ctx.student, tc.ctx.profile);
    } else if (input.section === 'personal_essay') {
      const personalEssay = tc.ctx.essays.find((e) => e.essay.applicationId === null);
      if (!personalEssay?.essay.currentDraftId) return fail("You don't have a personal essay draft saved yet.");
      const draft = await tc.sdb.selectOne(S.essayDrafts, eq(S.essayDrafts.id, personalEssay.essay.currentDraftId));
      if (!draft) return fail('Could not find your latest personal essay draft.');
      payload = buildPersonalEssayFillPayload(draft.content, 'student_message', null);
    } else {
      return fail("College-specific question filling isn't supported yet — I can fill your activities or profile.");
    }
    const summaryText = summarizeFillPayload(payload);
    const approval = await approvalsRepo.create(tc.sdb, {
      kind: 'fill_fields',
      summary: summaryText,
      payload,
      requestedVia: tc.run.channel,
      agentRunId: tc.run.id,
    });
    await appendAudit(tc.sdb, { actor: 'agent', action: 'approval.proposed', entityType: 'approval', entityId: approval.id, details: { section: input.section } });
    return ok({ approvalId: approval.id }, `Ready to put ${summaryText}. Want me to go ahead?`);
  },
});

export const ApproveProposalInput = z.object({ approval_id: z.string().uuid().optional() });

export const approveProposalTool = defineTool({
  name: 'approveProposal',
  description: 'Approve the latest pending proposal (or a specific one by id) and queue the fill job.',
  inputSchema: ApproveProposalInput,
  authorization: 'student_text',
  async run(tc, input) {
    const target = input.approval_id ? tc.ctx.pendingApprovals.find((a) => a.id === input.approval_id) : tc.ctx.pendingApprovals[0];
    if (!target) return fail("I don't have a pending proposal to approve right now.");
    const approved = await approvalsRepo.answer(tc.sdb, target.id, { approve: true, via: tc.run.channel, answerText: tc.run.studentText });
    const provider = tc.deps.env.BROWSER_PROVIDER === 'browserbase' ? 'browserbase' : 'local';
    const job = await browserJobsRepo.create(tc.sdb, { kind: 'fill_fields', provider, approvalId: approved.id });
    await tc.sdb.update(S.approvals, { resultingJobId: job.id }, eq(S.approvals.id, approved.id));
    await tc.deps.enqueuer.enqueue('browser.fill_fields', { studentId: tc.studentId, browserJobId: job.id, approvalId: approved.id }, { jobId: jobIds.fill(approved.id) });
    await appendAudit(tc.sdb, { actor: 'agent', action: 'approval.approved', entityType: 'approval', entityId: approved.id });
    return ok({ approvalId: approved.id, browserJobId: job.id }, `${approved.summary} — on it now.`);
  },
});

export const RejectProposalInput = z.object({ approval_id: z.string().uuid().optional() });

export const rejectProposalTool = defineTool({
  name: 'rejectProposal',
  description: 'Reject the latest pending proposal (or a specific one by id) — nothing gets filled.',
  inputSchema: RejectProposalInput,
  authorization: 'student_text',
  async run(tc, input) {
    const target = input.approval_id ? tc.ctx.pendingApprovals.find((a) => a.id === input.approval_id) : tc.ctx.pendingApprovals[0];
    if (!target) return fail("I don't have a pending proposal to cancel right now.");
    const rejected = await approvalsRepo.answer(tc.sdb, target.id, { approve: false, via: tc.run.channel, answerText: tc.run.studentText });
    await appendAudit(tc.sdb, { actor: 'agent', action: 'approval.rejected', entityType: 'approval', entityId: rejected.id });
    return ok({ approvalId: rejected.id }, "No problem — I won't fill that in. Let me know if you change your mind.");
  },
});
