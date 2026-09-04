/** Drop and recreate the public schema, then re-run migrations. Local development only. */
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate';

export async function resetDatabase(url: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to reset a production database');
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;');
  } finally {
    await sql.end();
  }
  await runMigrations(url);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  resetDatabase(url)
    .then(() => {
      process.stdout.write('database reset\n');
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
