/**
 * Per-school status derivation for one recommender's assignment row. The sync writer sets
 * `status` alongside `invited_at`/`submitted_at`, but a partial or stale sync can leave those out
 * of step (e.g. `submitted_at` set on a row whose `status` enum hasn't caught up yet) — so the
 * display status is derived defensively from all three rather than trusting `status` alone.
 */
import type { RecommenderAssignmentDto } from '@apogee/shared/api';
import type { RecommenderAssignmentStatus } from '@apogee/shared/domain';
import { type HeatStep, heatStep } from '@/lib/urgency';

/** One warm heat step for "invited" (colored by how close that school's deadline is), or the
 * quiet "ok" outcome color for "submitted". "Not yet invited" reuses heat step 0 — the same
 * secondary-text color a far-off deadline gets, since neither carries any urgency. */
export type SchoolStatusTone = HeatStep | 'ok';

export interface PerSchoolStatus {
  status: RecommenderAssignmentStatus;
  label: string;
  tone: SchoolStatusTone;
  /** What to show as "Last seen" — evidence text when we have it, else a status-appropriate note. */
  lastSeenText: string;
}

const STATUS_LABEL: Record<RecommenderAssignmentStatus, string> = {
  pending: 'Not yet invited',
  invited: 'Invited',
  submitted: 'Submitted',
};

type AssignmentInput = Pick<RecommenderAssignmentDto, 'status' | 'invited_at' | 'submitted_at' | 'evidence'>;

/** The furthest-along status implied by the row, trusting a date over a possibly-stale enum. */
function effectiveStatus(assignment: AssignmentInput): RecommenderAssignmentStatus {
  if (assignment.status === 'submitted' || assignment.submitted_at) return 'submitted';
  if (assignment.status === 'invited' || assignment.invited_at) return 'invited';
  return 'pending';
}

function fallbackLastSeenText(status: RecommenderAssignmentStatus): string {
  switch (status) {
    case 'submitted':
      return 'Submitted — not yet confirmed by a Common App sync.';
    case 'invited':
      return 'Invited — no confirmation from Common App yet.';
    case 'pending':
      return 'Not yet invited for this school.';
    default:
      return 'Unknown';
  }
}

/**
 * `daysRemaining` is the matching application's days-until-deadline (null when unknown) — only
 * consulted for an "invited" row, since that's the only status whose color should track urgency.
 */
export function derivePerSchoolStatus(assignment: AssignmentInput, daysRemaining: number | null): PerSchoolStatus {
  const status = effectiveStatus(assignment);
  const tone: SchoolStatusTone = status === 'submitted' ? 'ok' : status === 'invited' ? heatStep(daysRemaining) : 0;
  return {
    status,
    label: STATUS_LABEL[status],
    tone,
    lastSeenText: assignment.evidence?.text ? `Last seen: ${assignment.evidence.text}` : fallbackLastSeenText(status),
  };
}

/** "3 schools: 1 submitted, 2 invited" — the compact sentence for a recommender's Schools column. */
export function summarizeSchoolStatuses(assignments: AssignmentInput[]): string {
  if (assignments.length === 0) return 'Not assigned to any school yet';

  const counts = { submitted: 0, invited: 0, pending: 0 };
  for (const assignment of assignments) counts[effectiveStatus(assignment)] += 1;

  const parts: string[] = [];
  if (counts.submitted > 0) parts.push(`${counts.submitted} submitted`);
  if (counts.invited > 0) parts.push(`${counts.invited} invited`);
  if (counts.pending > 0) parts.push(`${counts.pending} not yet invited`);

  const schoolWord = assignments.length === 1 ? 'school' : 'schools';
  return `${assignments.length} ${schoolWord}: ${parts.join(', ')}`;
}
