import * as S from '@tbd/shared/db/schema';
import * as D from '@tbd/shared/api';

export function mapSchool(row: S.School): D.SchoolDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ceeb_code: row.ceebCode,
    common_app_member: row.commonAppMember,
    portal_url: row.portalUrl,
    website: row.website,
    city: row.city,
    state: row.state,
    type: row.type,
  };
}

export function mapSchoolWithRequirements(row: S.School, requirements: S.SchoolRequirementsRow | null): D.SchoolWithRequirementsDto {
  return {
    ...mapSchool(row),
    requirements: requirements?.data ?? null,
    needs_verification: requirements?.needsVerification ?? true,
    verified_at: requirements?.verifiedAt ? requirements.verifiedAt.toISOString() : null,
  };
}
