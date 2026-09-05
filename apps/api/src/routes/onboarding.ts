import { asc, desc, eq, inArray } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { AuthorizationError, credentialsRepo, studentsRepo } from '@tbd/shared/db';
import type { StudentDb } from '@tbd/shared/db';
import type * as D from '@tbd/shared/api';
import { ONBOARDING_STEP_COUNT } from '@tbd/shared/domain';
import { jobIds } from '@tbd/shared/jobs';
import { createApplication, DuplicateApplicationError, ensureStudentWideItems, InvalidSchoolInputError } from '@tbd/shared/services';
import { localDate } from '@tbd/shared/time';
import { normalizePhone } from '@tbd/messaging';
import { mapActivity, mapApplication, mapCredentialStatus, mapNarrative, mapProfile, mapStudent } from '../mappers';
import type { ApiDeps } from '../deps';
import { HttpError } from '../errors';
import { checklistStudentFromProfile, ensureProfile, replaceActivities } from './profileUtil';
import { authed, type Handlers } from './contract';

async function buildOnboardingState(deps: ApiDeps, sdb: StudentDb, studentId: string): Promise<D.OnboardingStateDto> {
  const student = await studentsRepo.findById(deps.db, studentId);
  if (!student) throw new AuthorizationError();

  const profile = await sdb.selectOne(S.studentProfiles);
  const activities = await sdb.select(S.activities, undefined, { orderBy: asc(S.activities.position) });
  const narrativeRows = await sdb.select(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version), limit: 1 });
  const applications = await sdb.select(S.applications);
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const items = await sdb.select(S.applicationItems);
  const itemsByApp = new Map<string, S.ApplicationItem[]>();
  for (const item of items) {
    if (!item.applicationId) continue;
    const arr = itemsByApp.get(item.applicationId) ?? [];
    arr.push(item);
    itemsByApp.set(item.applicationId, arr);
  }
  const now = deps.clock.now();
  const applicationDtos = applications.flatMap((a) => {
    const school = schoolById.get(a.schoolId);
    if (!school) return [];
    return [mapApplication(a, school, itemsByApp.get(a.id) ?? [], { now, timezone: student.timezone, commonAppBaseUrl: deps.env.COMMONAPP_BASE_URL })];
  });
  const credStatus = await credentialsRepo.status(sdb, 'common_app');

  return {
    step: student.onboardingStep,
    completed: student.onboardingCompletedAt !== null,
    student: mapStudent(student),
    profile: profile ? mapProfile(profile) : null,
    activities: activities.map(mapActivity),
    narrative: narrativeRows[0] ? mapNarrative(narrativeRows[0]) : null,
    applications: applicationDtos,
    credentials: mapCredentialStatus('common_app', credStatus),
    agent_phone_number: deps.messaging.phoneNumber,
    agent_name: deps.env.AGENT_NAME,
    privacy_url: '/privacy',
  };
}

async function setOnboardingStep(sdb: StudentDb, step: number): Promise<void> {
  await sdb.db.update(S.students).set({ onboardingStep: step }).where(eq(S.students.id, sdb.studentId));
}

export const onboardingHandlers: Pick<Handlers, 'onboardingGet' | 'onboardingStep' | 'onboardingComplete'> = {
  onboardingGet: authed(async ({ auth, sdb, deps }) => buildOnboardingState(deps, sdb, auth.studentId)),

  onboardingStep: authed(async ({ auth, sdb, deps, body }) => {
    const studentId = auth.studentId;

    switch (body.step) {
      case 1: {
        const phone = normalizePhone(body.data.phone_e164);
        if (phone) {
          const owner = await studentsRepo.findByPhone(deps.db, phone);
          if (owner && owner.id !== studentId) throw new HttpError(409, 'phone_in_use', 'That phone number is already in use by another student.');
        }
        await sdb.db
          .update(S.students)
          .set({
            firstName: body.data.first_name,
            lastName: body.data.last_name,
            preferredName: body.data.preferred_name,
            phoneE164: phone,
            highSchool: body.data.high_school,
            graduationYear: body.data.graduation_year,
            timezone: body.data.timezone,
            quietHoursStart: body.data.quiet_hours.start,
            quietHoursEnd: body.data.quiet_hours.end,
            nudgeIntensity: body.data.nudge_intensity,
            onboardingStep: 2,
          })
          .where(eq(S.students.id, studentId));
        break;
      }
      case 2: {
        await ensureProfile(sdb, { academics: body.data.academics, testScores: body.data.test_scores });
        await setOnboardingStep(sdb, 3);
        break;
      }
      case 3: {
        await replaceActivities(sdb, body.data.activities);
        await setOnboardingStep(sdb, 4);
        break;
      }
      case 4: {
        const narrative = await sdb.selectOne(S.studentNarratives);
        if (!narrative) throw new HttpError(400, 'narrative_missing', 'Complete the narrative interview before continuing.');
        await setOnboardingStep(sdb, 5);
        break;
      }
      case 5: {
        const profile = await ensureProfile(sdb, { demographics: body.data.demographics, goals: body.data.goals });
        const checklistStudent = checklistStudentFromProfile(profile);
        const today = localDate(deps.clock.now(), (await studentsRepo.findById(deps.db, studentId))?.timezone ?? 'UTC');
        for (const entry of body.data.applications) {
          try {
            await createApplication(
              deps.db,
              sdb,
              { schoolSlug: entry.school_slug, schoolName: entry.school_name, plan: entry.plan, selfAssessment: entry.self_assessment },
              { today, student: checklistStudent, enqueuer: deps.enqueuer },
            );
          } catch (err) {
            if (err instanceof DuplicateApplicationError || err instanceof InvalidSchoolInputError) continue;
            throw err;
          }
        }
        await ensureStudentWideItems(sdb, { today, student: checklistStudent, enqueuer: deps.enqueuer });
        await setOnboardingStep(sdb, 6);

        const student = await studentsRepo.findById(deps.db, studentId);
        if (student && student.welcomeSentAt === null && student.phoneE164) {
          await deps.enqueuer.enqueue('agent.welcome', { studentId }, { jobId: jobIds.welcome(studentId) });
        }
        break;
      }
      case 6: {
        await setOnboardingStep(sdb, 7);
        break;
      }
      case 7: {
        // no-op: confirmation step only.
        break;
      }
    }

    return buildOnboardingState(deps, sdb, studentId);
  }),

  onboardingComplete: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();

    if (!student.onboardingCompletedAt) {
      await sdb.db
        .update(S.students)
        .set({ onboardingCompletedAt: deps.clock.now(), onboardingStep: ONBOARDING_STEP_COUNT })
        .where(eq(S.students.id, auth.studentId));

      const credStatus = await credentialsRepo.status(sdb, 'common_app');
      if (credStatus) {
        const [jobRow] = await sdb.insert(S.browserJobs, { kind: 'full_sync', status: 'queued', provider: deps.env.BROWSER_PROVIDER });
        if (jobRow) {
          await deps.enqueuer.enqueue(
            'browser.full_sync',
            { studentId: auth.studentId, browserJobId: jobRow.id, reason: 'onboarding' },
            { jobId: jobIds.sync(auth.studentId, `onboarding-${jobRow.id}`) },
          );
        }
      }
      await deps.enqueuer.enqueue('maintenance.first_plan', { studentId: auth.studentId });
    }

    return buildOnboardingState(deps, sdb, auth.studentId);
  }),
};
