import { eq, inArray } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { AuthorizationError, studentsRepo, type StudentDb } from '@apogee/shared/db';
import { changePlan, createApplication, deleteApplication, DuplicateApplicationError, InvalidSchoolInputError } from '@apogee/shared/services';
import { localDate } from '@apogee/shared/time';
import { mapApplication, mapApplicationDetail } from '../mappers';
import type { ApiDeps } from '../deps';
import { HttpError } from '../errors';
import { checklistStudentFromProfile } from './profileUtil';
import { authed, type Handlers } from './contract';

async function loadSchool(sdb: StudentDb, schoolId: string): Promise<S.School> {
  const rows = await sdb.db.select().from(S.schools).where(eq(S.schools.id, schoolId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`school row missing for id ${schoolId}`);
  return row;
}

async function mapOpts(deps: ApiDeps, timezone: string) {
  return { now: deps.clock.now(), timezone, commonAppBaseUrl: deps.env.COMMONAPP_BASE_URL };
}

export const applicationHandlers: Pick<Handlers, 'applicationsList' | 'applicationCreate' | 'applicationGet' | 'applicationUpdate' | 'applicationDelete'> = {
  applicationsList: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const [applications, items] = await Promise.all([sdb.select(S.applications), sdb.select(S.applicationItems)]);
    const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
    const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
    const schoolById = new Map(schools.map((s) => [s.id, s]));
    const itemsByApp = new Map<string, S.ApplicationItem[]>();
    for (const item of items) {
      if (!item.applicationId) continue;
      const arr = itemsByApp.get(item.applicationId) ?? [];
      arr.push(item);
      itemsByApp.set(item.applicationId, arr);
    }
    const opts = await mapOpts(deps, student.timezone);
    return applications.flatMap((a) => {
      const school = schoolById.get(a.schoolId);
      if (!school) return [];
      return [mapApplication(a, school, itemsByApp.get(a.id) ?? [], opts)];
    });
  }),

  applicationCreate: authed(async ({ auth, sdb, deps, body }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const profile = await sdb.selectOne(S.studentProfiles);
    let application;
    try {
      application = await createApplication(
        deps.db,
        sdb,
        { schoolSlug: body.school_slug, schoolName: body.school_name, plan: body.plan, selfAssessment: body.self_assessment },
        { today: localDate(deps.clock.now(), student.timezone), student: checklistStudentFromProfile(profile), enqueuer: deps.enqueuer },
      );
    } catch (err) {
      if (err instanceof DuplicateApplicationError) throw new HttpError(409, 'already_exists', err.message);
      if (err instanceof InvalidSchoolInputError) throw new HttpError(400, 'validation_error', err.message);
      throw err;
    }
    const school = await loadSchool(sdb, application.schoolId);
    const items = await sdb.select(S.applicationItems, eq(S.applicationItems.applicationId, application.id));
    return mapApplication(application, school, items, await mapOpts(deps, student.timezone));
  }),

  applicationGet: authed(async ({ auth, sdb, deps, params }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const application = await sdb.requireOne(S.applications, eq(S.applications.id, params.id));
    const school = await loadSchool(sdb, application.schoolId);
    const items = await sdb.select(S.applicationItems, eq(S.applicationItems.applicationId, application.id));
    const reqRows = await sdb.db.select().from(S.schoolRequirements).where(eq(S.schoolRequirements.schoolId, school.id));
    const requirements = reqRows[reqRows.length - 1] ?? null;
    return mapApplicationDetail(application, school, items, requirements, await mapOpts(deps, student.timezone));
  }),

  applicationUpdate: authed(async ({ auth, sdb, deps, params, body }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    await sdb.requireOne(S.applications, eq(S.applications.id, params.id));

    if (body.plan !== undefined) {
      await changePlan(sdb, params.id, body.plan);
    }
    const set: Partial<S.NewApplication> = {};
    if (body.self_assessment !== undefined) set.selfAssessment = body.self_assessment;
    if (body.status !== undefined) {
      set.status = body.status;
      if (body.status === 'submitted') set.submittedAt = deps.clock.now();
    }
    if (body.decision !== undefined) set.decision = body.decision;
    if (body.notes !== undefined) set.notes = body.notes;
    if (Object.keys(set).length > 0) {
      await sdb.update(S.applications, set, eq(S.applications.id, params.id));
    }

    const application = await sdb.requireOne(S.applications, eq(S.applications.id, params.id));
    const school = await loadSchool(sdb, application.schoolId);
    const items = await sdb.select(S.applicationItems, eq(S.applicationItems.applicationId, application.id));
    return mapApplication(application, school, items, await mapOpts(deps, student.timezone));
  }),

  applicationDelete: authed(async ({ sdb, params }) => {
    await deleteApplication(sdb, params.id);
    return { ok: true };
  }),
};
