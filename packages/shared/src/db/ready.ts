/**
 * `pnpm db:ready`: make sure Postgres and Redis are reachable, the test database exists,
 * migrations are applied, and (in development) the demo student is seeded.
 */
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate';

async function ensureDatabase(url: string): Promise<void> {
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, '');
  u.pathname = '/postgres';
  const admin = postgres(u.toString(), { max: 1 });
  try {
    const rows = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (rows.length === 0) await admin.unsafe(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/tbd';
  const testUrl = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5432/tbd_test';
  await ensureDatabase(url);
  await ensureDatabase(testUrl);
  await runMigrations(url);
  await runMigrations(testUrl);
  process.stdout.write(`databases ready: ${url.replace(/:[^:@/]+@/, ':***@')}\n`);
  if (process.env.SKIP_SEED !== 'true') {
    const { seedDemoStudent } = await import('../seed/index');
    const { createDb } = await import('./client');
    const handle = createDb(url, { max: 2 });
    try {
      const result = await seedDemoStudent(handle.db);
      process.stdout.write(`seeded demo student ${result.studentId}\n`);
    } finally {
      await handle.close();
    }
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
