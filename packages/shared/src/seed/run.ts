/**
 * `pnpm db:seed`: seed the internal school dataset and the canonical demo student against
 * `DATABASE_URL`. Safe to re-run — both steps are idempotent.
 */
import { createDb } from '../db/client';
import { loadEnv } from '../config/env';
import { seedSchools } from './schools';
import { seedDemoStudent } from './demo';

async function main(): Promise<void> {
  const env = loadEnv();
  const handle = createDb(env.DATABASE_URL, { max: 2 });
  try {
    const schoolsResult = await seedSchools(handle.db);
    process.stdout.write(`schools: inserted ${schoolsResult.inserted}, updated ${schoolsResult.updated}\n`);

    const studentResult = await seedDemoStudent(handle.db);
    process.stdout.write(`demo student: ${studentResult.studentId}\n`);
    process.stdout.write(`admin: ${studentResult.adminId}\n`);
  } finally {
    await handle.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
