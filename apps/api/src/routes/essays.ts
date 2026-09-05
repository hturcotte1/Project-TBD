import { eq, inArray } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { AuthorizationError, studentsRepo, type StudentDb } from '@apogee/shared/db';
import { jobIds } from '@apogee/shared/jobs';
import { mapEssay, mapEssayDetail, type EssayDetailInput, type EssaySummaryInput } from '../mappers';
import { HttpError } from '../errors';
import { authed, type Handlers } from './contract';

/** Same rule as `@apogee/shared/seed`'s `wordCount`: trim, split on whitespace, count. */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

interface EssayContext {
  drafts: S.EssayDraft[];
  feedback: S.EssayFeedbackRow[];
  schoolName: string | null;
  dueDate: string | null;
  status: S.ApplicationItem['status'] | null;
}

async function loadEssayContexts(sdb: StudentDb, essays: S.Essay[]): Promise<Map<string, EssayContext>> {
  const essayIds = essays.map((e) => e.id);
  const itemIds = essays.map((e) => e.applicationItemId).filter((id): id is string => id !== null);
  const applicationIds = [...new Set(essays.map((e) => e.applicationId).filter((id): id is string => id !== null))];

  const [drafts, feedback, items, applications] = await Promise.all([
    essayIds.length ? sdb.select(S.essayDrafts, inArray(S.essayDrafts.essayId, essayIds)) : Promise.resolve([]),
    essayIds.length ? sdb.select(S.essayFeedback, inArray(S.essayFeedback.essayId, essayIds)) : Promise.resolve([]),
    itemIds.length ? sdb.select(S.applicationItems, inArray(S.applicationItems.id, itemIds)) : Promise.resolve([]),
    applicationIds.length ? sdb.select(S.applications, inArray(S.applications.id, applicationIds)) : Promise.resolve([]),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const appById = new Map(applications.map((a) => [a.id, a]));
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));

  const out = new Map<string, EssayContext>();
  for (const essay of essays) {
    const item = essay.applicationItemId ? itemById.get(essay.applicationItemId) : undefined;
    const application = essay.applicationId ? appById.get(essay.applicationId) : undefined;
    out.set(essay.id, {
      drafts: drafts.filter((d) => d.essayId === essay.id),
      feedback: feedback.filter((f) => f.essayId === essay.id),
      schoolName: application ? (schoolNameById.get(application.schoolId) ?? null) : null,
      dueDate: item?.dueDate ?? application?.deadline ?? null,
      status: item?.status ?? null,
    });
  }
  return out;
}

function summaryInput(essay: S.Essay, ctx: EssayContext, now: Date, timezone: string): EssaySummaryInput {
  const currentDraft = essay.currentDraftId ? (ctx.drafts.find((d) => d.id === essay.currentDraftId) ?? null) : null;
  return {
    essay,
    schoolName: ctx.schoolName,
    dueDate: ctx.dueDate,
    status: ctx.status,
    currentDraft,
    draftCount: ctx.drafts.length,
    feedbackCount: ctx.feedback.length,
    now,
    timezone,
  };
}

export const essayHandlers: Pick<Handlers, 'essaysList' | 'essayGet' | 'essaySaveDraft' | 'essayRequestFeedback'> = {
  essaysList: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const essays = await sdb.select(S.essays);
    const contexts = await loadEssayContexts(sdb, essays);
    const now = deps.clock.now();
    return essays.map((essay) => mapEssay(summaryInput(essay, contexts.get(essay.id)!, now, student.timezone)));
  }),

  essayGet: authed(async ({ auth, sdb, deps, params }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const essay = await sdb.requireOne(S.essays, eq(S.essays.id, params.id));
    const contexts = await loadEssayContexts(sdb, [essay]);
    const ctx = contexts.get(essay.id)!;
    const now = deps.clock.now();
    const input: EssayDetailInput = { ...summaryInput(essay, ctx, now, student.timezone), drafts: ctx.drafts, feedback: ctx.feedback };
    return mapEssayDetail(input);
  }),

  essaySaveDraft: authed(async ({ auth, sdb, deps, params, body }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const essay = await sdb.requireOne(S.essays, eq(S.essays.id, params.id));
    const drafts = await sdb.select(S.essayDrafts, eq(S.essayDrafts.essayId, essay.id));
    const currentDraft = essay.currentDraftId ? (drafts.find((d) => d.id === essay.currentDraftId) ?? null) : null;
    const wordCount = countWords(body.content);

    let updatedEssay = essay;
    if (body.mode === 'autosave' && currentDraft && currentDraft.source === 'dashboard_editor') {
      await sdb.update(S.essayDrafts, { content: body.content, wordCount }, eq(S.essayDrafts.id, currentDraft.id));
    } else {
      const nextVersion = drafts.reduce((max, d) => Math.max(max, d.version), 0) + 1;
      const [draft] = await sdb.insert(S.essayDrafts, { essayId: essay.id, version: nextVersion, content: body.content, wordCount, source: 'dashboard_editor' });
      if (!draft) throw new Error('failed to save draft');
      const [updated] = await sdb.update(S.essays, { currentDraftId: draft.id }, eq(S.essays.id, essay.id));
      if (updated) updatedEssay = updated;
    }

    const refreshedDrafts = await sdb.select(S.essayDrafts, eq(S.essayDrafts.essayId, essay.id));
    const contexts = await loadEssayContexts(sdb, [updatedEssay]);
    const ctx = contexts.get(updatedEssay.id)!;
    const now = deps.clock.now();
    const input: EssayDetailInput = { ...summaryInput(updatedEssay, { ...ctx, drafts: refreshedDrafts }, now, student.timezone), drafts: refreshedDrafts, feedback: ctx.feedback };
    return mapEssayDetail(input);
  }),

  essayRequestFeedback: authed(async ({ auth, sdb, deps, params }) => {
    const essay = await sdb.requireOne(S.essays, eq(S.essays.id, params.id));
    if (!essay.currentDraftId) throw new HttpError(400, 'no_draft', 'Save a draft before requesting feedback.');
    const [run] = await sdb.insert(S.agentRuns, { trigger: 'essay_feedback', model: deps.env.LLM_STRONG_MODEL, outcome: 'pending' });
    if (!run) throw new Error('failed to create agent run');
    await deps.enqueuer.enqueue(
      'agent.essay_feedback',
      { studentId: auth.studentId, essayId: essay.id, draftId: essay.currentDraftId, runId: run.id },
      { jobId: jobIds.essayFeedback(run.id) },
    );
    return { run_id: run.id };
  }),
};
