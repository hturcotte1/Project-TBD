import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';
import type { CredentialStatusView } from '@apogee/shared/db';

export function mapStudent(row: S.Student): D.StudentDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    first_name: row.firstName,
    last_name: row.lastName,
    preferred_name: row.preferredName,
    phone_e164: row.phoneE164,
    high_school: row.highSchool,
    graduation_year: row.graduationYear,
    timezone: row.timezone,
    quiet_hours: { start: row.quietHoursStart, end: row.quietHoursEnd },
    nudge_intensity: row.nudgeIntensity,
    onboarding_step: row.onboardingStep,
    onboarding_completed_at: row.onboardingCompletedAt ? row.onboardingCompletedAt.toISOString() : null,
    sync_paused_reason: row.syncPausedReason,
    snoozed_until: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}

export function mapProfile(row: S.StudentProfile): D.StudentProfileDto {
  return { academics: row.academics, test_scores: row.testScores, demographics: row.demographics, goals: row.goals };
}

export function mapActivity(row: S.Activity): D.ActivityDto {
  return {
    id: row.id,
    order: row.position,
    activity_type: row.activityType,
    position: row.positionTitle,
    organization: row.organization,
    description: row.description,
    grade_levels: row.gradeLevels,
    timing: row.timing,
    hours_per_week: Number(row.hoursPerWeek),
    weeks_per_year: row.weeksPerYear,
    continue_in_college: row.continueInCollege,
  };
}

export function mapNarrative(row: S.StudentNarrativeRow): D.NarrativeDto {
  return { id: row.id, version: row.version, narrative: row.narrative, created_at: row.createdAt.toISOString() };
}

export function mapCredentialStatus(provider: 'common_app' | 'gmail', status: CredentialStatusView | null): D.CredentialStatusDto {
  return {
    provider,
    connected: status !== null && status.status !== 'deleted',
    status: status?.status ?? null,
    username: status?.username ?? null,
    verified_at: status?.verifiedAt ? status.verifiedAt.toISOString() : null,
    last_used_at: status?.lastUsedAt ? status.lastUsedAt.toISOString() : null,
    failure_count: status?.failureCount ?? 0,
  };
}
