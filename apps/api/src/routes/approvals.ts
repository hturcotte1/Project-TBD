import { asc, desc, eq, isNull } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { approvalsRepo, AuthorizationError, browserJobsRepo, studentsRepo } from '@tbd/shared/db';
import { buildActivitiesFillPayload, buildPersonalEssayFillPayload, buildProfileFillPayload, summarizeFillPayload } from '@tbd/shared/domain';
import { jobIds } from '@tbd/shared/jobs';
import { Academics, Demographics, Goals, TestScores } from '@tbd/shared/schemas';
import type { ApprovalPayload } from '@tbd/shared/schemas';
import { mapApproval } from '../mappers';
import { HttpError } from '../errors';
import { authed, type Handlers } from './contract';

export const approvalHandlers: Pick<Handlers, 'approvalsList' | 'approvalAnswer' | 'approvalProposeFill'> = {
  approvalsList: authed(async ({ sdb, query }) => {
    const rows = await sdb.select(S.approvals, query.status ? eq(S.approvals.status, query.status) : undefined, { orderBy: desc(S.approvals.createdAt) });
    return rows.map(mapApproval);
  }),

  approvalAnswer: authed(async ({ auth, sdb, deps, params, body }) => {
    const approval = await sdb.requireOne(S.approvals, eq(S.approvals.id, params.id));
    if (body.approve && approval.kind === 'submit' && deps.env.AUTONOMY_LEVEL !== 'C') {
      throw new HttpError(403, 'autonomy_level', 'Submitting is not enabled at the current autonomy level.');
    }

    const answered = await approvalsRepo.answer(sdb, params.id, { approve: body.approve, via: 'dashboard' });

    if (!body.approve) return mapApproval(answered);

    const job = await browserJobsRepo.create(sdb, { kind: 'fill_fields', provider: deps.env.BROWSER_PROVIDER, approvalId: params.id });
    await deps.enqueuer.enqueue('browser.fill_fields', { studentId: auth.studentId, browserJobId: job.id, approvalId: params.id }, { jobId: jobIds.fill(params.id) });
    const [updated] = await sdb.update(S.approvals, { resultingJobId: job.id }, eq(S.approvals.id, params.id));
    return mapApproval(updated ?? answered);
  }),

  approvalProposeFill: authed(async ({ auth, sdb, deps, body }) => {
    let payload: ApprovalPayload;

    if (body.section === 'college_questions') {
      throw new HttpError(400, 'unsupported_section', 'College-specific questions are not yet supported for fill proposals.');
    } else if (body.section === 'activities') {
      const activities = await sdb.select(S.activities, undefined, { orderBy: asc(S.activities.position) });
      payload = buildActivitiesFillPayload(activities);
    } else if (body.section === 'profile') {
      const student = await studentsRepo.findById(deps.db, auth.studentId);
      if (!student) throw new AuthorizationError();
      const profile =
        (await sdb.selectOne(S.studentProfiles)) ??
        ({ studentId: auth.studentId, academics: Academics.parse({}), testScores: TestScores.parse({}), demographics: Demographics.parse({}), goals: Goals.parse({}), updatedAt: new Date() } as S.StudentProfile);
      payload = buildProfileFillPayload(student, profile);
    } else {
      const essay = await sdb.selectOne(S.essays, isNull(S.essays.applicationId));
      if (!essay || !essay.currentDraftId) throw new HttpError(400, 'no_draft', 'No personal essay draft to fill yet.');
      const draft = await sdb.selectOne(S.essayDrafts, eq(S.essayDrafts.id, essay.currentDraftId));
      if (!draft) throw new HttpError(400, 'no_draft', 'No personal essay draft to fill yet.');
      payload = buildPersonalEssayFillPayload(draft.content, 'dashboard_editor', null);
    }

    const approval = await approvalsRepo.create(sdb, { kind: 'fill_fields', summary: summarizeFillPayload(payload), payload, requestedVia: 'dashboard' });
    return mapApproval(approval);
  }),
};
