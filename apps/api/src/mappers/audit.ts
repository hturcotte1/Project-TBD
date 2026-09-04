import * as S from '@tbd/shared/db/schema';
import * as D from '@tbd/shared/api';

/** `replayUrlByBrowserJobId` is precomputed by the caller (one bulk lookup for a page of rows). */
export function mapAuditEntry(row: S.AuditEntry, replayUrlByBrowserJobId: Map<string, string | null>): D.AuditEntryDto {
  const replayUrl = row.entityType === 'browser_job' && row.entityId ? (replayUrlByBrowserJobId.get(row.entityId) ?? null) : null;
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    entity_type: row.entityType,
    entity_id: row.entityId,
    details: row.details,
    replay_url: replayUrl,
    created_at: row.createdAt.toISOString(),
  };
}
