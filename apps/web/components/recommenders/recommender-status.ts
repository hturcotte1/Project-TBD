/**
 * Per-school status derivation for one recommender's assignment row. The sync writer sets
 * `status` alongside `invited_at`/`submitted_at`, but a partial or stale sync can leave those out
 * of step (e.g. `submitted_at` set on a row whose `status` enum hasn't caught up yet) — so the
 * display status is derived defensively from all three rather than trusting `status` alone.
 */
import type { RecommenderAssignmentDto } from '@apogee/shared/api';
import type { RecommenderAssignmentStatus } from '@apogee/shared/domain';

export type AssignmentBadgeVariant = 'success' | 'warn' | 'outline';

export interface PerSchoolStatus {
  status: RecommenderAssignmentStatus;
  label: string;
  badgeVariant: AssignmentBadgeVariant;
  /** What to show as "Last seen" — evidence text when we have it, else a status-appropriate note. */
  lastSeenText: string;
}

const STATUS_LABEL: Record<RecommenderAssignmentStatus, string> = {
  pending: 'Not yet invited',
  invited: 'Invited',
  submitted: 'Submitted',
};

const STATUS_VARIANT: Record<RecommenderAssignmentStatus, AssignmentBadgeVariant> = {
  pending: 'outline',
  invited: 'warn',
  submitted: 'success',
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

export function derivePerSchoolStatus(assignment: AssignmentInput): PerSchoolStatus {
  const status = effectiveStatus(assignment);
  return {
    status,
    label: STATUS_LABEL[status],
    badgeVariant: STATUS_VARIANT[status],
    lastSeenText: assignment.evidence?.text ? `Last seen: ${assignment.evidence.text}` : fallbackLastSeenText(status),
  };
}
