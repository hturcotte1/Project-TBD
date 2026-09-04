import * as S from '@tbd/shared/db/schema';
import * as D from '@tbd/shared/api';
import type { StorageProvider } from '@tbd/shared/adapters';

export async function mapDocument(row: S.Document, storage: StorageProvider): Promise<D.DocumentDto> {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    filename: row.filename,
    content_type: row.contentType,
    size_bytes: row.sizeBytes,
    extraction_status: row.extractionStatus,
    extraction: row.extraction ?? null,
    extraction_error: row.extractionError,
    url: await storage.getUrl(row.storageKey),
    created_at: row.createdAt.toISOString(),
  };
}
