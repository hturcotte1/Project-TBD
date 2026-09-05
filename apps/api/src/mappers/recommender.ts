import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';

export interface RecommenderAssignmentInput {
  assignment: S.RecommenderAssignment;
  schoolName: string;
  deadline: string;
}

export function mapRecommenderAssignment(input: RecommenderAssignmentInput): D.RecommenderAssignmentDto {
  return {
    id: input.assignment.id,
    application_id: input.assignment.applicationId,
    school_name: input.schoolName,
    deadline: input.deadline,
    status: input.assignment.status,
    invited_at: input.assignment.invitedAt,
    submitted_at: input.assignment.submittedAt,
    evidence: input.assignment.evidence ?? null,
  };
}

export function mapRecommender(row: S.Recommender, assignments: RecommenderAssignmentInput[]): D.RecommenderDto {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    subject: row.subject,
    invite_status: row.inviteStatus,
    invited_at: row.invitedAt,
    last_nudged_at: row.lastNudgedAt ? row.lastNudgedAt.toISOString() : null,
    notes: row.notes,
    assignments: assignments.map(mapRecommenderAssignment),
  };
}
