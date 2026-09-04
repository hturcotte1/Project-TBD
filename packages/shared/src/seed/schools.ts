/**
 * Upserts the internal school dataset (`SCHOOL_DATASET`) into `schools` and `school_requirements`.
 * Safe to run repeatedly — every write is keyed by a stable natural key (`slug`, and
 * `(school_id, cycle)`) so re-running only ever updates rows in place.
 */
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '../db/client';
import * as S from '../db/schema';
import { loadEnv } from '../config/env';
import { SCHOOL_DATASET } from '../requirements';

export interface SeedSchoolsResult {
  inserted: number;
  updated: number;
}

/** Upserts every `SCHOOL_DATASET` entry. Idempotent: running it again only updates existing rows. */
export async function seedSchools(db: Db): Promise<SeedSchoolsResult> {
  let inserted = 0;
  let updated = 0;

  for (const entry of SCHOOL_DATASET) {
    const existing = await db.select({ id: S.schools.id }).from(S.schools).where(eq(S.schools.slug, entry.slug)).limit(1);

    const [school] = await db
      .insert(S.schools)
      .values({
        slug: entry.slug,
        name: entry.name,
        ceebCode: entry.ceeb_code,
        commonAppMember: entry.common_app_member,
        portalUrl: entry.portal_url,
        website: entry.website,
        city: entry.city,
        state: entry.state,
        type: entry.type,
        aliases: entry.aliases,
      })
      .onConflictDoUpdate({
        target: S.schools.slug,
        set: {
          name: entry.name,
          ceebCode: entry.ceeb_code,
          commonAppMember: entry.common_app_member,
          portalUrl: entry.portal_url,
          website: entry.website,
          city: entry.city,
          state: entry.state,
          type: entry.type,
          aliases: entry.aliases,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!school) throw new Error(`school upsert failed for slug "${entry.slug}"`);
    if (existing.length > 0) updated++;
    else inserted++;

    await db
      .insert(S.schoolRequirements)
      .values({
        schoolId: school.id,
        cycle: entry.requirements.cycle,
        data: entry.requirements,
        needsVerification: entry.requirements.needs_verification,
      })
      .onConflictDoUpdate({
        target: [S.schoolRequirements.schoolId, S.schoolRequirements.cycle],
        set: {
          data: entry.requirements,
          needsVerification: entry.requirements.needs_verification,
          updatedAt: new Date(),
        },
      });
  }

  return { inserted, updated };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const handle = createDb(env.DATABASE_URL, { max: 2 });
  try {
    const result = await seedSchools(handle.db);
    process.stdout.write(`schools: inserted ${result.inserted}, updated ${result.updated}\n`);
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
