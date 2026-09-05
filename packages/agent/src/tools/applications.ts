import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { APPLICATION_PLANS, type ApplicationPlan } from '@apogee/shared/domain';
import { createApplication, DuplicateApplicationError } from '@apogee/shared/services';
import { localDate } from '@apogee/shared/time';
import { findSchool } from '../integrations/shared-engines';
import { defineTool, fail, ok } from './types';

export const AddApplicationInput = z.object({ school: z.string().min(1).max(200), plan: z.enum(APPLICATION_PLANS).optional() });

export const addApplicationTool = defineTool({
  name: 'addApplication',
  description: "Add a school to the student's application list, seeding its requirements and checklist.",
  inputSchema: AddApplicationInput,
  authorization: 'student_text',
  async run(tc, input) {
    // Peeked only to pick a sensible default plan (the school's first offered plan) when the
    // student didn't name one; createApplication does the real (re-)lookup and DB work.
    const entry = findSchool(input.school);
    const plan: ApplicationPlan = input.plan ?? entry?.requirements.plans[0]?.plan ?? 'RD';
    const profile = tc.ctx.profile;
    const testScores = profile?.testScores;

    let application: S.Application;
    try {
      application = await createApplication(
        tc.deps.db,
        tc.sdb,
        { schoolName: input.school, plan, selfAssessment: null },
        {
          today: localDate(tc.deps.clock.now(), tc.ctx.student.timezone),
          student: {
            testStance: testScores?.test_optional_stance ?? 'undecided',
            hasSatOrAct: Boolean(testScores && (testScores.sat.length > 0 || testScores.act.length > 0)),
            financialConstraints: profile?.demographics.financial_constraints ?? null,
            firstGeneration: profile?.demographics.first_generation ?? null,
          },
          enqueuer: tc.deps.enqueuer,
        },
      );
    } catch (err) {
      if (err instanceof DuplicateApplicationError) return fail(`${err.schoolName} is already on your list.`);
      throw err;
    }

    const schoolRows = await tc.deps.db.select().from(S.schools).where(eq(S.schools.id, application.schoolId)).limit(1);
    const schoolName = schoolRows[0]?.name ?? input.school.trim();
    const needsVerification = entry ? entry.requirements.needs_verification : true;

    await appendAudit(tc.sdb, {
      actor: 'agent',
      action: 'application.added',
      entityType: 'application',
      entityId: application.id,
      details: { school: schoolName, plan: application.plan },
    });

    const verificationNote = needsVerification ? " I don't have verified requirements for them yet, so flag me if anything looks off." : '';
    return ok({ applicationId: application.id, schoolId: application.schoolId }, `Added ${schoolName} (${application.plan}, due ${application.deadline}).${verificationNote}`);
  },
});
