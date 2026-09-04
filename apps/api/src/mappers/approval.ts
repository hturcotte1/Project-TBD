import type * as S from '@tbd/shared/db/schema';
import type * as D from '@tbd/shared/api';

export function mapApproval(row: S.Approval): D.ApprovalDto {
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    payload: row.payload,
    status: row.status,
    requested_via: row.requestedVia,
    answered_via: row.answeredVia,
    answered_at: row.answeredAt ? row.answeredAt.toISOString() : null,
    resulting_job_id: row.resultingJobId,
    expires_at: row.expiresAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}
