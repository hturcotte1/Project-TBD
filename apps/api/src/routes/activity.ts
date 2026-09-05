import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { mapAgentRun, mapAuditEntry, mapBrowserJob, mapSnapshotSummary } from '../mappers';
import { authed, type Handlers } from './contract';

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}|${row.id}`;
}

function decodeCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.lastIndexOf('|');
  if (idx < 0) return null;
  const createdAt = new Date(cursor.slice(0, idx));
  const id = cursor.slice(idx + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

export const activityHandlers: Pick<Handlers, 'activityFeed' | 'browserJobsList' | 'agentRunsList' | 'agentRunGet' | 'snapshotsList'> = {
  activityFeed: authed(async ({ sdb, query }) => {
    const after = decodeCursor(query.cursor);
    const extra = after
      ? or(lt(S.auditLog.createdAt, after.createdAt), and(eq(S.auditLog.createdAt, after.createdAt), lt(S.auditLog.id, after.id)))
      : undefined;
    const rows = await sdb.select(S.auditLog, extra, { orderBy: [desc(S.auditLog.createdAt), desc(S.auditLog.id)], limit: query.limit });

    const browserJobIds = [...new Set(rows.filter((r) => r.entityType === 'browser_job' && r.entityId).map((r) => r.entityId as string))];
    const jobRows = browserJobIds.length ? await sdb.select(S.browserJobs, inArray(S.browserJobs.id, browserJobIds)) : [];
    const replayUrlById = new Map(jobRows.map((j) => [j.id, j.replayUrl]));

    const items = rows.map((r) => mapAuditEntry(r, replayUrlById));
    const next_cursor = rows.length === query.limit && rows.length > 0 ? encodeCursor(rows[rows.length - 1]!) : null;
    return { items, next_cursor };
  }),

  browserJobsList: authed(async ({ sdb, deps, query }) => {
    const after = decodeCursor(query.cursor);
    const rows = await sdb.select(S.browserJobs, after ? lt(S.browserJobs.createdAt, after.createdAt) : undefined, {
      orderBy: desc(S.browserJobs.createdAt),
      limit: query.limit,
    });
    return Promise.all(rows.map((r) => mapBrowserJob(r, deps.storage)));
  }),

  agentRunsList: authed(async ({ sdb, query }) => {
    const after = decodeCursor(query.cursor);
    const rows = await sdb.select(S.agentRuns, after ? lt(S.agentRuns.createdAt, after.createdAt) : undefined, {
      orderBy: desc(S.agentRuns.createdAt),
      limit: query.limit,
    });
    return rows.map(mapAgentRun);
  }),

  agentRunGet: authed(async ({ sdb, params }) => {
    const row = await sdb.requireOne(S.agentRuns, eq(S.agentRuns.id, params.id));
    return mapAgentRun(row);
  }),

  snapshotsList: authed(async ({ sdb, query }) => {
    const after = decodeCursor(query.cursor);
    const rows = await sdb.select(S.commonAppSnapshots, after ? lt(S.commonAppSnapshots.createdAt, after.createdAt) : undefined, {
      orderBy: desc(S.commonAppSnapshots.createdAt),
      limit: query.limit,
    });
    return rows.map(mapSnapshotSummary);
  }),
};
