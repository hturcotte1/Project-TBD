import { eq } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { AuthorizationError, credentialsRepo, studentsRepo } from '@tbd/shared/db';
import { normalizePhone } from '@tbd/messaging';
import { mapCredentialStatus } from '../mappers';
import { HttpError } from '../errors';
import { authed, type Handlers } from './contract';

export const settingsHandlers: Pick<Handlers, 'settingsGet' | 'settingsUpdate' | 'accountExport' | 'accountExportDownload' | 'accountDelete'> = {
  settingsGet: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const commonApp = mapCredentialStatus('common_app', await credentialsRepo.status(sdb, 'common_app'));
    const connected = [commonApp];
    if (deps.env.FEATURE_GMAIL) connected.push(mapCredentialStatus('gmail', await credentialsRepo.status(sdb, 'gmail')));
    return {
      phone_e164: student.phoneE164,
      timezone: student.timezone,
      quiet_hours: { start: student.quietHoursStart, end: student.quietHoursEnd },
      nudge_intensity: student.nudgeIntensity,
      agent_name: deps.env.AGENT_NAME,
      agent_phone_number: deps.messaging.phoneNumber,
      connected_accounts: connected,
      features: { gmail: deps.env.FEATURE_GMAIL },
    };
  }),

  settingsUpdate: authed(async ({ auth, sdb, deps, body }) => {
    const set: Partial<S.NewStudent> = {};
    if (body.phone_e164 !== undefined) {
      const phone = normalizePhone(body.phone_e164);
      if (phone) {
        const owner = await studentsRepo.findByPhone(deps.db, phone);
        if (owner && owner.id !== auth.studentId) throw new HttpError(409, 'phone_in_use', 'That phone number is already in use by another student.');
      }
      set.phoneE164 = phone;
    }
    if (body.timezone !== undefined) set.timezone = body.timezone;
    if (body.quiet_hours !== undefined) {
      set.quietHoursStart = body.quiet_hours.start;
      set.quietHoursEnd = body.quiet_hours.end;
    }
    if (body.nudge_intensity !== undefined) set.nudgeIntensity = body.nudge_intensity;
    if (Object.keys(set).length > 0) await sdb.db.update(S.students).set(set).where(eq(S.students.id, auth.studentId));

    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const commonApp = mapCredentialStatus('common_app', await credentialsRepo.status(sdb, 'common_app'));
    const connected = [commonApp];
    if (deps.env.FEATURE_GMAIL) connected.push(mapCredentialStatus('gmail', await credentialsRepo.status(sdb, 'gmail')));
    return {
      phone_e164: student.phoneE164,
      timezone: student.timezone,
      quiet_hours: { start: student.quietHoursStart, end: student.quietHoursEnd },
      nudge_intensity: student.nudgeIntensity,
      agent_name: deps.env.AGENT_NAME,
      agent_phone_number: deps.messaging.phoneNumber,
      connected_accounts: connected,
      features: { gmail: deps.env.FEATURE_GMAIL },
    };
  }),

  accountExport: authed(async ({ auth, sdb, deps }) => {
    const [run] = await sdb.insert(S.agentRuns, { trigger: 'manual', model: 'n/a', outcome: 'pending' });
    if (!run) throw new Error('failed to create export run');
    await deps.enqueuer.enqueue('maintenance.export_data', { studentId: auth.studentId, runId: run.id });
    return { run_id: run.id };
  }),

  accountExportDownload: authed(async ({ sdb, params }) => {
    const run = await sdb.requireOne(S.agentRuns, eq(S.agentRuns.id, params.id));
    const exportData = run.metadata.export;
    if (exportData === undefined) throw new HttpError(404, 'not_ready', 'Export is not ready yet.');
    return exportData;
  }),

  accountDelete: authed(async ({ auth, sdb, deps }) => {
    await sdb.db.update(S.students).set({ status: 'deleted' }).where(eq(S.students.id, auth.studentId));
    await deps.enqueuer.enqueue('maintenance.delete_account', { studentId: auth.studentId });
    return { ok: true };
  }),
};
