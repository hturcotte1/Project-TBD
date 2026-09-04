import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | DbTransaction;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

/** Create a database handle. Callers own its lifecycle; call close() on shutdown. */
export function createDb(url: string, opts: { max?: number } = {}): DbHandle {
  const client = postgres(url, { max: opts.max ?? 10, prepare: false, onnotice: () => undefined });
  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { db, close: () => client.end({ timeout: 5 }) };
}

export { schema };
