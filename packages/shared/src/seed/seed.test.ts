import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as S from '../db/schema';
import { closeTestDb, getTestDb, truncateAll } from '../testing/db';
import { scoped } from '../db/repos/scoped';
import { credentialsRepo } from '../db/repos/core';
import { loadEnv, resetEnvCache } from '../config/env';
import { generateKeyBase64, parseKeyRing } from '../crypto/credentials';
import { CommonAppSnapshot } from '../schemas';
import { DEMO_STUDENT, demoSnapshot, seedDemoStudent, seedSchools, wordCount } from './index';

const ADMIN_AUTH_USER_ID = 'dev:admin@example.com';

// `config/env.ts`'s built-in default for CREDENTIALS_ENCRYPTION_KEYS decodes to 35 bytes, not the
// 32 AES-256-GCM requires — a pre-existing issue outside packages/shared/src/seed. Give this
// process a valid key so seedDemoStudent's credential step (and this suite) does not depend on it.
beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEYS = `1:${generateKeyBase64()}`;
  process.env.CREDENTIALS_ENCRYPTION_KEY_VERSION = '1';
  resetEnvCache();
});

const EXPECTED_APPLICATIONS: Record<string, { plan: string; deadline: string; commonApp: boolean }> = {
  umich: { plan: 'EA', deadline: '2026-11-01', commonApp: true },
  northwestern: { plan: 'ED', deadline: '2026-11-01', commonApp: true },
  uchicago: { plan: 'EA', deadline: '2026-11-01', commonApp: true },
  uiuc: { plan: 'EA', deadline: '2026-11-01', commonApp: true },
  wisconsin: { plan: 'EA', deadline: '2026-11-01', commonApp: true },
  purdue: { plan: 'EA', deadline: '2026-11-01', commonApp: true },
  indiana: { plan: 'EA', deadline: '2026-11-01', commonApp: true },
  georgetown: { plan: 'RD', deadline: '2027-01-10', commonApp: false },
  washu: { plan: 'RD', deadline: '2027-01-02', commonApp: true },
  emory: { plan: 'RD', deadline: '2027-01-01', commonApp: true },
  vanderbilt: { plan: 'RD', deadline: '2027-01-01', commonApp: true },
  'loyola-chicago': { plan: 'rolling', deadline: '2026-12-01', commonApp: true },
};

function withinTolerance(actual: number, expected: number, tolerance = 3): void {
  expect(Math.abs(actual - expected), `expected ${actual} to be within ${tolerance} of ${expected}`).toBeLessThanOrEqual(tolerance);
}

describe('wordCount', () => {
  it('counts whitespace-separated words and handles empty input', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('one')).toBe(1);
    expect(wordCount('one two  three\nfour')).toBe(4);
  });
});

describe('seedSchools', () => {
  beforeAll(async () => truncateAll(await getTestDb()));
  afterAll(closeTestDb);

  it('upserts at least 60 schools and is idempotent on a second run', async () => {
    const db = await getTestDb();

    const first = await seedSchools(db);
    expect(first.inserted).toBeGreaterThanOrEqual(60);
    expect(first.updated).toBe(0);

    const afterFirst = await db.select().from(S.schools);
    expect(afterFirst.length).toBeGreaterThanOrEqual(60);
    const reqAfterFirst = await db.select().from(S.schoolRequirements);
    expect(reqAfterFirst.length).toBe(afterFirst.length);

    const second = await seedSchools(db);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(afterFirst.length);

    const afterSecond = await db.select().from(S.schools);
    expect(afterSecond.length).toBe(afterFirst.length);
    for (const slug of Object.keys(EXPECTED_APPLICATIONS)) {
      expect(afterSecond.some((s) => s.slug === slug), `missing seeded school "${slug}"`).toBe(true);
    }
  });
});

describe('demoSnapshot', () => {
  it('parses as CommonAppSnapshot and contains exactly 11 colleges (Georgetown excluded)', () => {
    const snapshot = demoSnapshot('2026-09-03T14:00:00Z');
    expect(() => CommonAppSnapshot.parse(snapshot)).not.toThrow();
    expect(snapshot.colleges).toHaveLength(11);
    expect(snapshot.colleges.some((c) => c.name.includes('Georgetown'))).toBe(false);
    expect(snapshot.sections.writing).toMatchObject({ status: 'in_progress', prompt_index: 5, word_count: 412 });
    expect(snapshot.sections.activities_count).toBe(6);
    expect(snapshot.testing.self_reported).toEqual([{ test: 'SAT', score: '1450', date: '2026-06-06' }]);
    expect(snapshot.low_confidence_sections).toEqual([]);
    for (const value of Object.values(snapshot.confidence)) expect(value).toBe(1);
  });
});

describe('seedDemoStudent — idempotency', () => {
  beforeAll(async () => truncateAll(await getTestDb()));
  afterAll(closeTestDb);

  it('re-running leaves exactly one demo student and one admin', async () => {
    const db = await getTestDb();
    const first = await seedDemoStudent(db);
    const second = await seedDemoStudent(db);

    // Delete-and-recreate: the second run's ids differ from the first's.
    expect(second.studentId).not.toBe(first.studentId);
    expect(second.adminId).not.toBe(first.adminId);

    const demoRows = await db.select().from(S.students).where(eq(S.students.authUserId, DEMO_STUDENT.authUserId));
    expect(demoRows).toHaveLength(1);
    expect(demoRows[0]?.id).toBe(second.studentId);

    const adminRows = await db.select().from(S.students).where(eq(S.students.authUserId, ADMIN_AUTH_USER_ID));
    expect(adminRows).toHaveLength(1);
    expect(adminRows[0]?.id).toBe(second.adminId);
    expect(adminRows[0]?.role).toBe('admin');

    // Cascade actually ran: the first run's data is gone, not accumulated.
    const applications = await db.select().from(S.applications).where(eq(S.applications.studentId, second.studentId));
    expect(applications).toHaveLength(12);
  });
});

describe('seedDemoStudent — seeded fixture', () => {
  let studentId: string;

  beforeAll(async () => {
    const db = await getTestDb();
    await truncateAll(db);
    const result = await seedDemoStudent(db);
    studentId = result.studentId;
  });
  afterAll(closeTestDb);

  it('creates the 12 applications with the documented plans, deadlines, and Common App membership', async () => {
    const db = await getTestDb();
    const rows = await db
      .select({ slug: S.schools.slug, plan: S.applications.plan, deadline: S.applications.deadline, commonAppCollegeId: S.applications.commonAppCollegeId, deadlineSource: S.applications.deadlineSource })
      .from(S.applications)
      .innerJoin(S.schools, eq(S.applications.schoolId, S.schools.id))
      .where(eq(S.applications.studentId, studentId));

    expect(rows).toHaveLength(12);
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const [slug, expected] of Object.entries(EXPECTED_APPLICATIONS)) {
      const row = bySlug.get(slug);
      expect(row, `missing application for "${slug}"`).toBeDefined();
      expect(row?.plan).toBe(expected.plan);
      expect(row?.deadline).toBe(expected.deadline);
      expect(row?.deadlineSource).toBe('internal_dataset');
      expect(row?.commonAppCollegeId).toBe(expected.commonApp ? slug : null);
    }
  });

  it('builds at least 5 checklist items per application, and at least 60 items overall', async () => {
    const db = await getTestDb();
    const items = await db.select().from(S.applicationItems).where(eq(S.applicationItems.studentId, studentId));
    expect(items.length).toBeGreaterThanOrEqual(12 * 5);

    const perApplication = new Map<string, number>();
    for (const item of items) {
      if (!item.applicationId) continue;
      perApplication.set(item.applicationId, (perApplication.get(item.applicationId) ?? 0) + 1);
    }
    expect(perApplication.size).toBe(12);
    for (const [applicationId, count] of perApplication) {
      expect(count, `application ${applicationId} has too few items`).toBeGreaterThanOrEqual(5);
    }

    // Student-wide items (no application): 6 sections + personal essay + FAFSA.
    const studentWide = items.filter((i) => i.applicationId === null);
    expect(studentWide.map((i) => i.ruleKey).sort()).toEqual(
      ['fafsa', 'section:activities', 'section:courses_grades', 'section:education', 'section:family', 'section:profile', 'section:testing', 'writing:personal_essay'].sort(),
    );
  });

  it('seeds exactly 8 activities in position order', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const activities = await sdb.select(S.activities, undefined, { orderBy: asc(S.activities.position) });
    expect(activities).toHaveLength(8);
    expect(activities.map((a) => a.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(activities.map((a) => a.activityType)).toContain('journalism_publication');
    expect(activities.map((a) => a.activityType)).toContain('student_government');
    for (const a of activities) expect(a.description.length).toBeLessThanOrEqual(150);
  });

  it('seeds 3 recommenders with Park assigned to 3 applications, Okafor to 2, Diaz to every Common App school', async () => {
    const db = await getTestDb();
    const recommenders = await db.select().from(S.recommenders).where(eq(S.recommenders.studentId, studentId));
    expect(recommenders).toHaveLength(3);
    const park = recommenders.find((r) => r.name === 'Ms. Park');
    const okafor = recommenders.find((r) => r.name === 'Mr. Okafor');
    const diaz = recommenders.find((r) => r.name === 'Mr. Diaz');
    expect(park && okafor && diaz).toBeTruthy();

    const assignments = await db.select().from(S.recommenderAssignments).where(eq(S.recommenderAssignments.studentId, studentId));
    expect(assignments.filter((a) => a.recommenderId === park!.id)).toHaveLength(3);
    expect(assignments.filter((a) => a.recommenderId === okafor!.id)).toHaveLength(2);
    expect(assignments.filter((a) => a.recommenderId === diaz!.id)).toHaveLength(11);
    expect(assignments.filter((a) => a.recommenderId === okafor!.id).every((a) => a.status === 'submitted')).toBe(true);
    expect(assignments.filter((a) => a.recommenderId === diaz!.id).every((a) => a.status === 'pending')).toBe(true);
  });

  it('seeds 5 essays with the documented draft counts and word counts within tolerance', async () => {
    const db = await getTestDb();
    const essays = await db.select().from(S.essays).where(eq(S.essays.studentId, studentId));
    expect(essays).toHaveLength(5);
    const drafts = await db.select().from(S.essayDrafts).where(eq(S.essayDrafts.studentId, studentId));

    const byTitle = new Map(essays.map((e) => [e.title, e]));
    const draftsFor = (essayId: string) => drafts.filter((d) => d.essayId === essayId).sort((a, b) => a.version - b.version);

    const personal = byTitle.get('Personal essay');
    expect(personal).toBeDefined();
    const personalDrafts = draftsFor(personal!.id);
    expect(personalDrafts).toHaveLength(2);
    withinTolerance(personalDrafts[0]!.wordCount, 380);
    withinTolerance(personalDrafts[1]!.wordCount, 412);
    expect(personal!.currentDraftId).toBe(personalDrafts[1]!.id);

    const community = byTitle.get('Community essay');
    expect(community).toBeDefined();
    const communityDrafts = draftsFor(community!.id);
    expect(communityDrafts).toHaveLength(1);
    withinTolerance(communityDrafts[0]!.wordCount, 298);

    const whyMichigan = byTitle.get('Why Michigan');
    expect(whyMichigan).toBeDefined();
    withinTolerance(draftsFor(whyMichigan!.id)[0]!.wordCount, 143);

    const whyUchicago = byTitle.get('Why UChicago');
    expect(whyUchicago).toBeDefined();
    withinTolerance(draftsFor(whyUchicago!.id)[0]!.wordCount, 102);

    const whyNorthwestern = byTitle.get('Why Northwestern');
    expect(whyNorthwestern).toBeDefined();
    expect(draftsFor(whyNorthwestern!.id)).toHaveLength(0);
    expect(whyNorthwestern!.currentDraftId).toBeNull();

    // Every stored word count was computed by the exported wordCount() helper.
    for (const draft of drafts) expect(draft.wordCount).toBe(wordCount(draft.content));
  });

  it('links essays back onto their application items', async () => {
    const db = await getTestDb();
    const items = await db.select().from(S.applicationItems).where(eq(S.applicationItems.studentId, studentId));
    const withEssay = items.filter((i) => i.essayId !== null);
    expect(withEssay).toHaveLength(5);
  });

  it('seeds the conversation with 4 messages in the documented order', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const conversations = await sdb.select(S.conversations);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.kind).toBe('main');

    const messages = await sdb.select(S.messages, undefined, { orderBy: asc(S.messages.createdAt) });
    expect(messages).toHaveLength(4);
    expect(messages.map((m) => m.direction)).toEqual(['outbound', 'inbound', 'outbound', 'outbound']);
    expect(messages[1]?.body.toLowerCase()).toContain('what should i do first');
    expect(messages[3]?.proactive).toBe(true);
    expect(messages.every((m) => m.channel === 'imessage')).toBe(true);
  });

  it('seeds one acknowledged recommender_inactivity nudge tied to the Michigan application', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const nudges = await sdb.select(S.nudges);
    expect(nudges).toHaveLength(1);
    expect(nudges[0]?.kind).toBe('recommender_inactivity');
    expect(nudges[0]?.acknowledgedAt).not.toBeNull();

    const umichApp = await db
      .select({ id: S.applications.id })
      .from(S.applications)
      .innerJoin(S.schools, eq(S.applications.schoolId, S.schools.id))
      .where(eq(S.schools.slug, 'umich'));
    expect(nudges[0]?.applicationId).toBe(umichApp[0]?.id);
  });

  it('produces non-empty next actions with rank 1 present and a school named in some reason', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const actions = await sdb.select(S.nextActions, undefined, { orderBy: asc(S.nextActions.rank) });
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.rank).toBe(1);
    expect(actions.map((a) => a.rank)).toEqual(actions.map((_, i) => i + 1));
    const schoolNames = ['Michigan', 'Northwestern', 'Chicago', 'Illinois', 'Wisconsin', 'Purdue', 'Indiana', 'Georgetown', 'Washington University', 'Emory', 'Vanderbilt', 'Loyola'];
    expect(actions.some((a) => schoolNames.some((name) => a.reason.includes(name)))).toBe(true);
  });

  it('stores a snapshot that parses and matches demoSnapshot exactly, with the full_sync browser job', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const snapshots = await sdb.select(S.commonAppSnapshots);
    expect(snapshots).toHaveLength(1);
    const stored = snapshots[0]!;
    expect(() => CommonAppSnapshot.parse(stored.normalized)).not.toThrow();
    expect(stored.normalized.colleges).toHaveLength(11);
    expect(stored.diff).toEqual([]);
    expect(stored.overallConfidence).toBe('1.000');

    const jobs = await sdb.select(S.browserJobs, undefined, { orderBy: asc(S.browserJobs.createdAt) });
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.kind)).toEqual(['verify_credentials', 'full_sync']);
    expect(jobs.every((j) => j.status === 'succeeded')).toBe(true);
    expect(jobs.every((j) => j.provider === 'local')).toBe(true);
    expect(stored.browserJobId).toBe(jobs[1]!.id);
    expect(jobs[1]!.result?.snapshot_id).toBe(stored.id);
  });

  it('stores credentials that decrypt to the demo Common App password', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const env = loadEnv();
    const ring = parseKeyRing(env.CREDENTIALS_ENCRYPTION_KEYS, env.CREDENTIALS_ENCRYPTION_KEY_VERSION);
    const decrypted = await credentialsRepo.decryptForWorker(sdb, ring, 'common_app');
    expect(decrypted?.username).toBe(DEMO_STUDENT.commonAppEmail);
    expect(decrypted?.secret).toBe(DEMO_STUDENT.commonAppPassword);

    const status = await credentialsRepo.status(sdb, 'common_app');
    expect(status?.status).toBe('active');
    expect(status?.verifiedAt).not.toBeNull();
  });

  it('records the seeding audit trail', async () => {
    const db = await getTestDb();
    const sdb = scoped(db, studentId);
    const entries = await sdb.select(S.auditLog);
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('seed.demo_student');
    expect(actions).toContain('sync.completed');
    expect(actions).toContain('message.sent');
    expect(entries.every((e) => e.actor === 'system')).toBe(true);
  });
});
