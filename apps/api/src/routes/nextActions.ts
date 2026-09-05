import { eq, inArray } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { AuthorizationError, nudgesRepo, studentsRepo, type StudentDb } from '@apogee/shared/db';
import { recomputeNextActions } from '@apogee/shared/services';
import { localDate } from '@apogee/shared/time';
import { mapNextAction } from '../mappers';
import { authed, type Handlers } from './contract';

async function schoolNameByApplicationId(sdb: StudentDb, applicationIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(applicationIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const applications = await sdb.select(S.applications, inArray(S.applications.id, ids));
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolById = new Map(schools.map((s) => [s.id, s.name]));
  const out = new Map<string, string>();
  for (const a of applications) {
    const name = schoolById.get(a.schoolId);
    if (name) out.set(a.id, name);
  }
  return out;
}

export const nextActionHandlers: Pick<Handlers, 'nextActionsList' | 'nextActionUpdate' | 'nextActionsRecompute'> = {
  nextActionsList: authed(async ({ auth, sdb, deps, query }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const rows = await sdb.select(S.nextActions, query.include_closed ? undefined : eq(S.nextActions.status, 'open'));
    const names = await schoolNameByApplicationId(sdb, rows.map((r) => r.applicationId));
    const now = deps.clock.now();
    return rows
      .sort((a, b) => a.rank - b.rank)
      .map((r) => mapNextAction(r, r.applicationId ? (names.get(r.applicationId) ?? null) : null, now, student.timezone));
  }),

  nextActionUpdate: authed(async ({ auth, sdb, deps, params, body }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const set: Partial<S.NewNextAction> = { status: body.status };
    if (body.snoozed_until !== undefined) set.snoozedUntil = body.snoozed_until ? new Date(body.snoozed_until) : null;
    const [row] = await sdb.update(S.nextActions, set, eq(S.nextActions.id, params.id));
    if (!row) throw new AuthorizationError();

    if (row.applicationItemId) {
      if (body.status === 'done') {
        await sdb.update(S.applicationItems, { status: 'done', completedAt: deps.clock.now(), studentEdited: true }, eq(S.applicationItems.id, row.applicationItemId));
        await nudgesRepo.acknowledgeForItem(sdb, row.applicationItemId);
      } else if (body.status === 'snoozed' && row.snoozedUntil) {
        await nudgesRepo.snoozeForItem(sdb, row.applicationItemId, row.snoozedUntil);
      }
    }

    const names = await schoolNameByApplicationId(sdb, [row.applicationId]);
    return mapNextAction(row, row.applicationId ? (names.get(row.applicationId) ?? null) : null, deps.clock.now(), student.timezone);
  }),

  nextActionsRecompute: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const rows = await recomputeNextActions(sdb, { today: localDate(deps.clock.now(), student.timezone), intensity: student.nudgeIntensity });
    const names = await schoolNameByApplicationId(sdb, rows.map((r) => r.applicationId));
    const now = deps.clock.now();
    return rows.map((r) => mapNextAction(r, r.applicationId ? (names.get(r.applicationId) ?? null) : null, now, student.timezone));
  }),
};
