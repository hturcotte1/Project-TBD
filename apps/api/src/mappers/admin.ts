import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';
import { mapStudent } from './student';

export interface AdminStudentAggregate {
  student: S.Student;
  applicationsCount: number;
  openItems: number;
  lastSyncedAt: Date | null;
  lastJobStatus: S.BrowserJob['status'] | null;
  failedJobs24h: number;
  tokensInput30d: number;
  tokensOutput30d: number;
  browserMinutes30d: number;
}

export function mapAdminStudent(a: AdminStudentAggregate): D.AdminStudentDto {
  return {
    student: mapStudent(a.student),
    applications_count: a.applicationsCount,
    open_items: a.openItems,
    last_synced_at: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null,
    last_job_status: a.lastJobStatus,
    failed_jobs_24h: a.failedJobs24h,
    tokens_30d: { input: a.tokensInput30d, output: a.tokensOutput30d },
    browser_minutes_30d: a.browserMinutes30d,
  };
}

export function mapQueueHealth(queue: string, counts: { waiting?: number; active?: number; delayed?: number; failed?: number; completed?: number }): D.QueueHealthDto {
  return {
    queue,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
    completed: counts.completed ?? 0,
  };
}

export function mapDriftAlert(row: S.SiteDriftAlert): D.DriftAlertDto {
  return {
    id: row.id,
    section: row.section,
    confidence: Number(row.confidence),
    details: row.details,
    browser_job_id: row.browserJobId,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

/**
 * Estimated USD cost of an LLM call: $2/M input + $10/M output tokens for sonnet-class models,
 * $5/M input + $25/M output for opus-class models (matched by name prefix). This is a rough,
 * documented assumption for the admin cost report, not a vendor-verified rate.
 */
export function estimateLlmCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const isOpusClass = /opus/i.test(model);
  const inputRate = isOpusClass ? 5 : 2;
  const outputRate = isOpusClass ? 25 : 10;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}
