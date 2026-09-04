/**
 * Student-scoped data access. Every student-owned table has a `studentId` column; `StudentDb`
 * adds `student_id = :studentId` to every select/update/delete and forces it on every insert.
 * Application code reads and writes student data only through this class (see the
 * authorization scan test in ../../testing/authz-scan.test.ts).
 */
import { and, count, eq, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { DbOrTx } from '../client';

/** A table that carries a student_id column. */
export type StudentOwnedTable = PgTable & { studentId: PgColumn };

export class AuthorizationError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface StudentScope {
  studentId: string;
}

export interface SelectOptions {
  orderBy?: SQL | SQL[];
  limit?: number;
  offset?: number;
}

export class StudentDb {
  constructor(
    readonly db: DbOrTx,
    readonly studentId: string,
  ) {
    if (!studentId) throw new AuthorizationError('missing student scope');
  }

  /** Predicate for this student on a table, optionally ANDed with more conditions. */
  where<T extends StudentOwnedTable>(table: T, extra?: SQL): SQL {
    const base = eq(table.studentId, this.studentId);
    return extra ? (and(base, extra) as SQL) : base;
  }

  /** `select * from table where student_id = me [and extra]` with optional ordering and paging. */
  async select<T extends StudentOwnedTable>(table: T, extra?: SQL, opts: SelectOptions = {}): Promise<T['$inferSelect'][]> {
    let q = this.db.select().from(table as PgTable).where(this.where(table, extra)).$dynamic();
    if (opts.orderBy) q = q.orderBy(...(Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy]));
    if (opts.limit !== undefined) q = q.limit(opts.limit);
    if (opts.offset !== undefined) q = q.offset(opts.offset);
    return (await q) as T['$inferSelect'][];
  }

  async selectOne<T extends StudentOwnedTable>(table: T, extra?: SQL, opts: Omit<SelectOptions, 'limit'> = {}): Promise<T['$inferSelect'] | null> {
    const rows = await this.select(table, extra, { ...opts, limit: 1 });
    return rows[0] ?? null;
  }

  /** Like selectOne but throws AuthorizationError (mapped to 404) when absent. */
  async requireOne<T extends StudentOwnedTable>(table: T, extra?: SQL): Promise<T['$inferSelect']> {
    const row = await this.selectOne(table, extra);
    if (!row) throw new AuthorizationError();
    return row;
  }

  async count<T extends StudentOwnedTable>(table: T, extra?: SQL): Promise<number> {
    const rows = await this.db.select({ n: count() }).from(table as PgTable).where(this.where(table, extra));
    return Number(rows[0]?.n ?? 0);
  }

  /** Insert with student_id forced to this scope, whatever the caller passed. */
  insert<T extends StudentOwnedTable>(table: T, values: Omit<T['$inferInsert'], 'studentId'> | Array<Omit<T['$inferInsert'], 'studentId'>>) {
    const rows = (Array.isArray(values) ? values : [values]).map((v) => ({ ...v, studentId: this.studentId })) as T['$inferInsert'][];
    return this.db.insert(table).values(rows).returning();
  }

  update<T extends StudentOwnedTable>(table: T, set: PgUpdateSetSource<T>, extra?: SQL) {
    const safeSet = { ...set } as PgUpdateSetSource<T> & { studentId?: unknown };
    delete safeSet.studentId;
    return this.db.update(table).set(safeSet).where(this.where(table, extra)).returning();
  }

  delete<T extends StudentOwnedTable>(table: T, extra?: SQL) {
    return this.db.delete(table).where(this.where(table, extra)).returning();
  }
}

export function scoped(db: DbOrTx, scope: StudentScope | string): StudentDb {
  return new StudentDb(db, typeof scope === 'string' ? scope : scope.studentId);
}
