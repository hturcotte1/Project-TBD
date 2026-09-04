import * as S from '@tbd/shared/db/schema';
import type { StudentDb } from '@tbd/shared/db';
import { Academics, type ActivityList, Demographics, Goals, TestScores } from '@tbd/shared/schemas';
import type { ChecklistStudent } from '@tbd/shared/requirements';
import type { z } from 'zod';

/** The requirements engine's view of a student, derived from the (possibly absent) profile row. */
export function checklistStudentFromProfile(profile: S.StudentProfile | null): ChecklistStudent {
  return {
    testStance: profile?.testScores.test_optional_stance ?? 'undecided',
    hasSatOrAct: Boolean(profile && (profile.testScores.sat.length > 0 || profile.testScores.act.length > 0)),
    financialConstraints: profile?.demographics.financial_constraints ?? null,
    firstGeneration: profile?.demographics.first_generation ?? null,
  };
}

/** Replaces the student's ordered activity list (used by onboarding step 3 and PUT /activities). */
export async function replaceActivities(sdb: StudentDb, activities: z.infer<typeof ActivityList>): Promise<S.Activity[]> {
  await sdb.delete(S.activities);
  if (activities.length === 0) return [];
  return sdb.insert(
    S.activities,
    activities.map((a, i) => ({
      position: i + 1,
      activityType: a.activity_type,
      positionTitle: a.position,
      organization: a.organization,
      description: a.description,
      gradeLevels: a.grade_levels,
      timing: a.timing,
      hoursPerWeek: String(a.hours_per_week),
      weeksPerYear: a.weeks_per_year,
      continueInCollege: a.continue_in_college,
    })),
  );
}

export interface ProfilePatch {
  academics?: S.StudentProfile['academics'];
  testScores?: S.StudentProfile['testScores'];
  demographics?: S.StudentProfile['demographics'];
  goals?: S.StudentProfile['goals'];
}

/** Creates the student's profile row (with empty defaults for whatever wasn't given) if it
 * doesn't exist yet, else merges the patch into the existing row. Onboarding steps 2 and 5 (and
 * the dashboard's profile-section routes) can arrive in any order, so both paths must work. */
export async function ensureProfile(sdb: StudentDb, patch: ProfilePatch): Promise<S.StudentProfile> {
  const existing = await sdb.selectOne(S.studentProfiles);
  if (!existing) {
    const [created] = await sdb.insert(S.studentProfiles, {
      academics: patch.academics ?? Academics.parse({}),
      testScores: patch.testScores ?? TestScores.parse({}),
      demographics: patch.demographics ?? Demographics.parse({}),
      goals: patch.goals ?? Goals.parse({}),
    });
    if (!created) throw new Error('failed to create student profile');
    return created;
  }
  const [updated] = await sdb.update(S.studentProfiles, { ...patch, updatedAt: new Date() });
  if (!updated) throw new Error('failed to update student profile');
  return updated;
}
