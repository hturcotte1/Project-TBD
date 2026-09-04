import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { AuthorizationError, nudgesRepo, studentsRepo } from '@tbd/shared/db';
import { recomputeNextActions } from '@tbd/shared/services';
import { localDate } from '@tbd/shared/time';
import { mapApplicationItem } from '../mappers';
import { HttpError } from '../errors';
import { authed, type Handlers } from './contract';

export const itemHandlers: Pick<Handlers, 'itemsList' | 'itemCreate' | 'itemUpdate' | 'itemDelete'> = {
  itemsList: authed(async ({ sdb, query }) => {
    const conditions = [];
    if (query.application_id !== undefined) conditions.push(eq(S.applicationItems.applicationId, query.application_id));
    if (query.status !== undefined) conditions.push(eq(S.applicationItems.status, query.status));
    const extra = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await sdb.select(S.applicationItems, extra);
    return rows.map(mapApplicationItem);
  }),

  itemCreate: authed(async ({ sdb, body }) => {
    if (body.application_id) await sdb.requireOne(S.applications, eq(S.applications.id, body.application_id));
    const [row] = await sdb.insert(S.applicationItems, {
      applicationId: body.application_id,
      ruleKey: `custom:${randomUUID()}`,
      kind: 'custom',
      title: body.title,
      description: body.description,
      source: 'student',
      status: 'missing',
      dueDate: body.due_date,
      importance: 50,
      effort: 'medium',
      dependsOnOthers: false,
      blocking: false,
      studentEdited: true,
    });
    if (!row) throw new Error('failed to create item');
    return mapApplicationItem(row);
  }),

  itemUpdate: authed(async ({ auth, sdb, deps, params, body }) => {
    const existing = await sdb.requireOne(S.applicationItems, eq(S.applicationItems.id, params.id));
    const set: Partial<S.NewApplicationItem> = { studentEdited: true };
    if (body.notes !== undefined) set.notes = body.notes;
    if (body.due_date !== undefined) set.dueDate = body.due_date;
    if (body.status !== undefined) {
      set.status = body.status;
      if (existing.status !== 'done' && body.status === 'done') set.completedAt = new Date();
      else if (existing.status === 'done' && body.status !== 'done') set.completedAt = null;
    }
    const [row] = await sdb.update(S.applicationItems, set, eq(S.applicationItems.id, params.id));
    if (!row) throw new AuthorizationError();

    if (body.status === 'done') {
      await nudgesRepo.acknowledgeForItem(sdb, row.id);
      const student = await studentsRepo.findById(deps.db, auth.studentId);
      if (student) {
        await recomputeNextActions(sdb, { today: localDate(deps.clock.now(), student.timezone), intensity: student.nudgeIntensity });
      }
    }
    return mapApplicationItem(row);
  }),

  itemDelete: authed(async ({ sdb, params }) => {
    const existing = await sdb.requireOne(S.applicationItems, eq(S.applicationItems.id, params.id));
    if (existing.source !== 'student') throw new HttpError(400, 'not_deletable', 'Only custom items you added can be deleted.');
    await sdb.delete(S.applicationItems, eq(S.applicationItems.id, params.id));
    return { ok: true };
  }),
};
