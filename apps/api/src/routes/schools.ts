import { eq, ilike, inArray } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { AuthorizationError } from '@tbd/shared/db';
import { findSchools } from '@tbd/shared/requirements';
import { mapSchoolWithRequirements } from '../mappers';
import { authed, type Handlers } from './contract';

const SEARCH_LIMIT = 20;

export const schoolHandlers: Pick<Handlers, 'schoolsSearch' | 'schoolGet'> = {
  schoolsSearch: authed(async ({ query, sdb }) => {
    const datasetMatches = findSchools(query.q, SEARCH_LIMIT);
    const slugs = datasetMatches.map((e) => e.slug);
    const bySlug = slugs.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.slug, slugs)) : [];
    const bySlugMap = new Map(bySlug.map((s) => [s.slug, s]));

    const trimmed = query.q.trim();
    const textMatches = trimmed ? await sdb.db.select().from(S.schools).where(ilike(S.schools.name, `%${trimmed}%`)).limit(SEARCH_LIMIT) : [];

    const seen = new Set<string>();
    const ordered: S.School[] = [];
    for (const slug of slugs) {
      const row = bySlugMap.get(slug);
      if (row && !seen.has(row.id)) {
        ordered.push(row);
        seen.add(row.id);
      }
    }
    for (const row of textMatches) {
      if (!seen.has(row.id)) {
        ordered.push(row);
        seen.add(row.id);
      }
    }

    const schoolIds = ordered.map((s) => s.id);
    const reqRows = schoolIds.length ? await sdb.db.select().from(S.schoolRequirements).where(inArray(S.schoolRequirements.schoolId, schoolIds)) : [];
    const reqBySchool = new Map<string, S.SchoolRequirementsRow>();
    for (const r of reqRows) {
      const cur = reqBySchool.get(r.schoolId);
      if (!cur || r.updatedAt > cur.updatedAt) reqBySchool.set(r.schoolId, r);
    }

    return ordered.slice(0, SEARCH_LIMIT).map((s) => mapSchoolWithRequirements(s, reqBySchool.get(s.id) ?? null));
  }),

  schoolGet: authed(async ({ params, sdb }) => {
    const rows = await sdb.db.select().from(S.schools).where(eq(S.schools.slug, params.slug)).limit(1);
    const school = rows[0];
    if (!school) throw new AuthorizationError();
    const reqRows = await sdb.db.select().from(S.schoolRequirements).where(eq(S.schoolRequirements.schoolId, school.id));
    const requirements = reqRows[reqRows.length - 1] ?? null;
    return mapSchoolWithRequirements(school, requirements);
  }),
};
