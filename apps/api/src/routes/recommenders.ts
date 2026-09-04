import { eq, inArray } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { AuthorizationError, type StudentDb } from '@tbd/shared/db';
import { mapRecommender, type RecommenderAssignmentInput } from '../mappers';
import { authed, type Handlers } from './contract';

async function loadAssignments(sdb: StudentDb, recommenderIds: string[]): Promise<Map<string, RecommenderAssignmentInput[]>> {
  const out = new Map<string, RecommenderAssignmentInput[]>();
  if (recommenderIds.length === 0) return out;
  const assignments = await sdb.select(S.recommenderAssignments, inArray(S.recommenderAssignments.recommenderId, recommenderIds));
  const applicationIds = [...new Set(assignments.map((a) => a.applicationId))];
  const applications = applicationIds.length ? await sdb.select(S.applications, inArray(S.applications.id, applicationIds)) : [];
  const appById = new Map(applications.map((a) => [a.id, a]));
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));

  for (const assignment of assignments) {
    const application = appById.get(assignment.applicationId);
    const input: RecommenderAssignmentInput = {
      assignment,
      schoolName: application ? (schoolNameById.get(application.schoolId) ?? '') : '',
      deadline: application?.deadline ?? '',
    };
    const arr = out.get(assignment.recommenderId) ?? [];
    arr.push(input);
    out.set(assignment.recommenderId, arr);
  }
  return out;
}

export const recommenderHandlers: Pick<Handlers, 'recommendersList' | 'recommenderCreate' | 'recommenderUpdate' | 'recommenderDelete' | 'recommenderReminderDraft'> = {
  recommendersList: authed(async ({ sdb }) => {
    const rows = await sdb.select(S.recommenders);
    const assignments = await loadAssignments(sdb, rows.map((r) => r.id));
    return rows.map((r) => mapRecommender(r, assignments.get(r.id) ?? []));
  }),

  recommenderCreate: authed(async ({ sdb, body }) => {
    const [row] = await sdb.insert(S.recommenders, {
      name: body.name,
      role: body.role,
      email: body.email,
      subject: body.subject,
      inviteStatus: 'not_invited',
      invitedAt: null,
    });
    if (!row) throw new Error('failed to create recommender');

    for (const applicationId of body.application_ids) {
      await sdb.requireOne(S.applications, eq(S.applications.id, applicationId));
      await sdb.insert(S.recommenderAssignments, { recommenderId: row.id, applicationId, status: 'pending', invitedAt: null, submittedAt: null });
    }

    const assignments = await loadAssignments(sdb, [row.id]);
    return mapRecommender(row, assignments.get(row.id) ?? []);
  }),

  recommenderUpdate: authed(async ({ sdb, params, body }) => {
    const set: Partial<S.NewRecommender> = {};
    if (body.name !== undefined) set.name = body.name;
    if (body.email !== undefined) set.email = body.email;
    if (body.subject !== undefined) set.subject = body.subject;
    if (body.notes !== undefined) set.notes = body.notes;
    if (body.invite_status !== undefined) set.inviteStatus = body.invite_status;
    if (body.invited_at !== undefined) set.invitedAt = body.invited_at;

    let row = Object.keys(set).length > 0 ? (await sdb.update(S.recommenders, set, eq(S.recommenders.id, params.id)))[0] : await sdb.selectOne(S.recommenders, eq(S.recommenders.id, params.id));
    if (!row) throw new AuthorizationError();

    if (body.application_ids !== undefined) {
      const existing = await sdb.select(S.recommenderAssignments, eq(S.recommenderAssignments.recommenderId, params.id));
      const desired = new Set(body.application_ids);
      const existingByApp = new Map(existing.map((a) => [a.applicationId, a]));
      for (const stale of existing) {
        if (!desired.has(stale.applicationId)) await sdb.delete(S.recommenderAssignments, eq(S.recommenderAssignments.id, stale.id));
      }
      for (const applicationId of body.application_ids) {
        if (!existingByApp.has(applicationId)) {
          await sdb.requireOne(S.applications, eq(S.applications.id, applicationId));
          await sdb.insert(S.recommenderAssignments, { recommenderId: params.id, applicationId, status: 'pending', invitedAt: null, submittedAt: null });
        }
      }
    }

    const assignments = await loadAssignments(sdb, [params.id]);
    return mapRecommender(row, assignments.get(params.id) ?? []);
  }),

  recommenderDelete: authed(async ({ sdb, params }) => {
    const rows = await sdb.delete(S.recommenders, eq(S.recommenders.id, params.id));
    if (rows.length === 0) throw new AuthorizationError();
    return { ok: true };
  }),

  recommenderReminderDraft: authed(async ({ auth, sdb, deps, params }) => {
    await sdb.requireOne(S.recommenders, eq(S.recommenders.id, params.id));
    const [run] = await sdb.insert(S.agentRuns, { trigger: 'reminder_draft', model: deps.env.LLM_DEFAULT_MODEL, outcome: 'pending' });
    if (!run) throw new Error('failed to create agent run');
    await deps.enqueuer.enqueue('agent.reminder_draft', { studentId: auth.studentId, recommenderId: params.id, runId: run.id });
    return { run_id: run.id };
  }),
};
