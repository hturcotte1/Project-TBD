/**
 * Integration-test database helper. Uses DATABASE_URL_TEST, applies migrations once per process,
 * and truncates every table between tests. Tests that need Postgres call `useTestDb()`.
 */
import { getTableName, sql } from 'drizzle-orm';
import { createDb, type Db, type DbHandle } from '../db/client';
import { runMigrations } from '../db/migrate';
import * as S from '../db/schema';

let handle: DbHandle | null = null;
let migrated = false;

export function testDatabaseUrl(): string {
  return process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/tbd_test';
}

export async function getTestDb(): Promise<Db> {
  const url = testDatabaseUrl();
  if (!migrated) {
    await runMigrations(url);
    migrated = true;
  }
  if (!handle) handle = createDb(url, { max: 4 });
  return handle.db;
}

const TABLES = [
  S.webhookEvents,
  S.siteDriftAlerts,
  S.weeklyPlans,
  S.nudges,
  S.credentials,
  S.auditLog,
  S.browserJobs,
  S.approvals,
  S.agentRuns,
  S.messages,
  S.conversations,
  S.nextActions,
  S.recommenderAssignments,
  S.recommenders,
  S.essayFeedback,
  S.essayDrafts,
  S.essays,
  S.commonAppSnapshots,
  S.applicationItems,
  S.applications,
  S.schoolRequirements,
  S.schools,
  S.documents,
  S.activities,
  S.studentNarratives,
  S.studentProfiles,
  S.students,
];

export async function truncateAll(db: Db): Promise<void> {
  const names = TABLES.map((t) => `"${getTableName(t)}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

export async function closeTestDb(): Promise<void> {
  if (handle) {
    await handle.close();
    handle = null;
  }
}

export async function createTestStudent(db: Db, overrides: Partial<S.NewStudent> = {}): Promise<S.Student> {
  const n = Math.random().toString(36).slice(2, 8);
  const [row] = await db
    .insert(S.students)
    .values({
      email: `student-${n}@example.com`,
      authUserId: `dev:${n}`,
      firstName: 'Test',
      lastName: n,
      phoneE164: `+1555${n.replace(/\D/g, '1').padEnd(7, '1').slice(0, 7)}`,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('failed to create test student');
  return row;
}

export async function createTestSchool(db: Db, overrides: Partial<S.NewSchool> = {}): Promise<S.School> {
  const n = Math.random().toString(36).slice(2, 8);
  const [row] = await db
    .insert(S.schools)
    .values({ slug: `school-${n}`, name: `Test University ${n}`, city: 'Testville', state: 'TS', ...overrides })
    .returning();
  if (!row) throw new Error('failed to create test school');
  return row;
}
