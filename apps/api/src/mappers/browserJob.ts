import type * as S from '@tbd/shared/db/schema';
import type * as D from '@tbd/shared/api';
import type { StorageProvider } from '@tbd/shared/adapters';

export async function mapBrowserJob(row: S.BrowserJob, storage: StorageProvider): Promise<D.BrowserJobDto> {
  const screenshots = await Promise.all(
    row.screenshots.map(async (s) => ({ page: s.page, url: await storage.getUrl(s.storage_key), taken_at: s.taken_at })),
  );
  return {
    id: row.id,
    student_id: row.studentId,
    kind: row.kind,
    status: row.status,
    provider: row.provider,
    replay_url: row.replayUrl,
    screenshots,
    result: row.result ?? null,
    error: row.error,
    attempts: row.attempts,
    started_at: row.startedAt ? row.startedAt.toISOString() : null,
    finished_at: row.finishedAt ? row.finishedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}
