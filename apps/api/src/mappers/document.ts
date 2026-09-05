import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';
import type { StorageProvider } from '@apogee/shared/adapters';

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
