import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';

export function mapSnapshotSummary(row: S.CommonAppSnapshotRow): D.SnapshotSummaryDto {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    overall_confidence: Number(row.overallConfidence),
    low_confidence_sections: row.normalized.low_confidence_sections,
    changes: row.diff,
  };
}
