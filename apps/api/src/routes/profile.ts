import { asc, desc, eq } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { AuthorizationError, studentsRepo } from '@tbd/shared/db';
import * as D from '@tbd/shared/api';
import { Academics, Demographics, Goals, TestScores } from '@tbd/shared/schemas';
import { mapActivity, mapNarrative, mapProfile, mapStudent } from '../mappers';
import { ensureProfile, replaceActivities } from './profileUtil';
import { authed, type Handlers } from './contract';

const EMPTY_PROFILE_DTO: D.StudentProfileDto = {
  academics: Academics.parse({}),
  test_scores: TestScores.parse({}),
  demographics: Demographics.parse({}),
  goals: Goals.parse({}),
};

export const profileHandlers: Pick<
  Handlers,
  | 'profileGet'
  | 'profileUpdateBasics'
  | 'profileUpdateAcademics'
  | 'profileUpdateTestScores'
  | 'profileUpdateDemographics'
  | 'profileUpdateGoals'
  | 'activitiesReplace'
  | 'narrativeGet'
  | 'narrativeUpdate'
  | 'narrativeRestartInterview'
  | 'narrativeSummarize'
> = {
  profileGet: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const [profileRow, activities, narrativeRows] = await Promise.all([
      sdb.selectOne(S.studentProfiles),
      sdb.select(S.activities, undefined, { orderBy: asc(S.activities.position) }),
      sdb.select(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version), limit: 1 }),
    ]);
    return {
      student: mapStudent(student),
      profile: profileRow ? mapProfile(profileRow) : EMPTY_PROFILE_DTO,
      activities: activities.map(mapActivity),
      narrative: narrativeRows[0] ? mapNarrative(narrativeRows[0]) : null,
    };
  }),

  profileUpdateBasics: authed(async ({ auth, sdb, deps, body }) => {
    const set: Partial<S.NewStudent> = {};
    if (body.first_name !== undefined) set.firstName = body.first_name;
    if (body.last_name !== undefined) set.lastName = body.last_name;
    if (body.preferred_name !== undefined) set.preferredName = body.preferred_name;
    if (body.high_school !== undefined) set.highSchool = body.high_school;
    if (body.graduation_year !== undefined) set.graduationYear = body.graduation_year;
    if (Object.keys(set).length > 0) {
      await sdb.db.update(S.students).set(set).where(eq(S.students.id, auth.studentId));
    }
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    return mapStudent(student);
  }),

  profileUpdateAcademics: authed(async ({ sdb, body }) => mapProfile(await ensureProfile(sdb, { academics: body }))),
  profileUpdateTestScores: authed(async ({ sdb, body }) => mapProfile(await ensureProfile(sdb, { testScores: body }))),
  profileUpdateDemographics: authed(async ({ sdb, body }) => mapProfile(await ensureProfile(sdb, { demographics: body }))),
  profileUpdateGoals: authed(async ({ sdb, body }) => mapProfile(await ensureProfile(sdb, { goals: body }))),

  activitiesReplace: authed(async ({ sdb, body }) => {
    const rows = await replaceActivities(sdb, body.activities);
    return rows.sort((a, b) => a.position - b.position).map(mapActivity);
  }),

  narrativeGet: authed(async ({ sdb }) => {
    const row = await sdb.selectOne(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version) });
    return row ? mapNarrative(row) : null;
  }),

  narrativeUpdate: authed(async ({ sdb, body }) => {
    const latest = await sdb.selectOne(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version) });
    const version = (latest?.version ?? 0) + 1;
    const [row] = await sdb.insert(S.studentNarratives, { version, narrative: body, interviewConversationId: latest?.interviewConversationId ?? null });
    if (!row) throw new Error('failed to save narrative');
    return mapNarrative(row);
  }),

  narrativeRestartInterview: authed(async ({ sdb }) => {
    await sdb.delete(S.conversations, eq(S.conversations.kind, 'interview'));
    return { ok: true };
  }),

  narrativeSummarize: authed(async ({ auth, sdb, deps }) => {
    const [run] = await sdb.insert(S.agentRuns, { trigger: 'interview', model: deps.env.LLM_STRONG_MODEL, outcome: 'pending' });
    if (!run) throw new Error('failed to create agent run');
    await deps.enqueuer.enqueue('agent.narrative_summary', { studentId: auth.studentId, runId: run.id });
    return { run_id: run.id };
  }),
};
