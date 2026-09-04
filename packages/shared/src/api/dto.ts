/**
 * Wire shapes (DTOs). Dates are ISO strings. These are the only shapes the web app sees.
 * Row types live in ../db/schema; the API maps rows to these.
 */
import { z } from 'zod';
import * as E from '../domain/enums';
import {
  Academics,
  ActivityInput,
  ApprovalPayload,
  BrowserJobResult,
  Demographics,
  DocumentExtraction,
  EssayFeedback,
  Goals,
  ItemEvidence,
  MediaRef,
  QuietHours,
  SchoolRequirementsData,
  StateChange,
  StudentNarrative,
  TestScores,
  ToolCallRecord,
  WeeklyPlan,
} from '../schemas';
import { IsoDate, IsoDateTime, Uuid } from '../schemas/common';

const nullableDateTime = IsoDateTime.nullable();

export const StudentDto = z.object({
  id: Uuid,
  email: z.string(),
  role: z.enum(E.ROLES),
  status: z.enum(E.STUDENT_STATUSES),
  first_name: z.string(),
  last_name: z.string(),
  preferred_name: z.string(),
  phone_e164: z.string().nullable(),
  high_school: z.string(),
  graduation_year: z.number().int().nullable(),
  timezone: z.string(),
  quiet_hours: QuietHours,
  nudge_intensity: z.enum(E.NUDGE_INTENSITIES),
  onboarding_step: z.number().int(),
  onboarding_completed_at: nullableDateTime,
  sync_paused_reason: z.string().nullable(),
  snoozed_until: nullableDateTime,
  created_at: IsoDateTime,
});
export type StudentDto = z.infer<typeof StudentDto>;

export const StudentProfileDto = z.object({
  academics: Academics,
  test_scores: TestScores,
  demographics: Demographics,
  goals: Goals,
});
export type StudentProfileDto = z.infer<typeof StudentProfileDto>;

export const ActivityDto = ActivityInput.extend({ id: Uuid, position: z.number().int() });
export type ActivityDto = z.infer<typeof ActivityDto>;

export const NarrativeDto = z.object({
  id: Uuid,
  version: z.number().int(),
  narrative: StudentNarrative,
  created_at: IsoDateTime,
});
export type NarrativeDto = z.infer<typeof NarrativeDto>;

export const DocumentDto = z.object({
  id: Uuid,
  kind: z.enum(E.DOCUMENT_KINDS),
  source: z.enum(E.DOCUMENT_SOURCES),
  filename: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int(),
  extraction_status: z.enum(E.EXTRACTION_STATUSES),
  extraction: DocumentExtraction.nullable(),
  extraction_error: z.string().nullable(),
  url: z.string().nullable(),
  created_at: IsoDateTime,
});
export type DocumentDto = z.infer<typeof DocumentDto>;

export const SchoolDto = z.object({
  id: Uuid,
  slug: z.string(),
  name: z.string(),
  ceeb_code: z.string().nullable(),
  common_app_member: z.boolean(),
  portal_url: z.string().nullable(),
  website: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  type: z.enum(E.SCHOOL_TYPES),
});
export type SchoolDto = z.infer<typeof SchoolDto>;

export const SchoolWithRequirementsDto = SchoolDto.extend({
  requirements: SchoolRequirementsData.nullable(),
  needs_verification: z.boolean(),
  verified_at: nullableDateTime,
});
export type SchoolWithRequirementsDto = z.infer<typeof SchoolWithRequirementsDto>;

export const ApplicationItemDto = z.object({
  id: Uuid,
  application_id: Uuid.nullable(),
  rule_key: z.string(),
  kind: z.enum(E.ITEM_KINDS),
  title: z.string(),
  description: z.string(),
  source: z.enum(E.ITEM_SOURCES),
  status: z.enum(E.ITEM_STATUSES),
  evidence: ItemEvidence.nullable(),
  due_date: IsoDate.nullable(),
  importance: z.number().int(),
  effort: z.enum(E.EFFORT_LEVELS),
  depends_on_others: z.boolean(),
  blocking: z.boolean(),
  student_edited: z.boolean(),
  notes: z.string(),
  essay_id: Uuid.nullable(),
  recommender_id: Uuid.nullable(),
  last_checked_at: nullableDateTime,
  completed_at: nullableDateTime,
  updated_at: IsoDateTime,
});
export type ApplicationItemDto = z.infer<typeof ApplicationItemDto>;

export const ItemCountsDto = z.object({
  total: z.number().int(),
  done: z.number().int(),
  missing: z.number().int(),
  in_progress: z.number().int(),
  blocked: z.number().int(),
  not_applicable: z.number().int(),
});

export const ApplicationDto = z.object({
  id: Uuid,
  school: SchoolDto,
  plan: z.enum(E.APPLICATION_PLANS),
  deadline: IsoDate,
  deadline_source: z.string(),
  days_remaining: z.number().int(),
  status: z.enum(E.APPLICATION_STATUSES),
  decision: z.enum(E.DECISION_OUTCOMES).nullable(),
  self_assessment: z.enum(E.SELF_ASSESSMENTS).nullable(),
  submitted_at: nullableDateTime,
  last_synced_at: nullableDateTime,
  notes: z.string(),
  counts: ItemCountsDto,
  /** 0..100, done / (total - not_applicable). */
  completion_percent: z.number(),
  common_app_url: z.string().nullable(),
});
export type ApplicationDto = z.infer<typeof ApplicationDto>;

export const ApplicationDetailDto = ApplicationDto.extend({
  items: z.array(ApplicationItemDto),
  requirements: SchoolRequirementsData.nullable(),
});
export type ApplicationDetailDto = z.infer<typeof ApplicationDetailDto>;

export const NextActionDto = z.object({
  id: Uuid,
  application_item_id: Uuid.nullable(),
  application_id: Uuid.nullable(),
  school_name: z.string().nullable(),
  action: z.string(),
  reason: z.string(),
  priority_score: z.number(),
  rank: z.number().int(),
  due_date: IsoDate.nullable(),
  days_remaining: z.number().int().nullable(),
  status: z.enum(E.NEXT_ACTION_STATUSES),
  snoozed_until: nullableDateTime,
  updated_at: IsoDateTime,
});
export type NextActionDto = z.infer<typeof NextActionDto>;

export const EssayDraftDto = z.object({
  id: Uuid,
  version: z.number().int(),
  content: z.string(),
  word_count: z.number().int(),
  source: z.string(),
  created_at: IsoDateTime,
});
export const EssayFeedbackDto = z.object({
  id: Uuid,
  essay_draft_id: Uuid,
  feedback: EssayFeedback,
  created_at: IsoDateTime,
});
export const EssayDto = z.object({
  id: Uuid,
  application_id: Uuid.nullable(),
  application_item_id: Uuid.nullable(),
  school_name: z.string().nullable(),
  title: z.string(),
  prompt: z.string(),
  word_limit: z.number().int().nullable(),
  due_date: IsoDate.nullable(),
  days_remaining: z.number().int().nullable(),
  current_word_count: z.number().int(),
  draft_count: z.number().int(),
  last_edited_at: nullableDateTime,
  feedback_count: z.number().int(),
  status: z.enum(E.ITEM_STATUSES).nullable(),
});
export type EssayDto = z.infer<typeof EssayDto>;
export const EssayDetailDto = EssayDto.extend({
  current_draft: EssayDraftDto.nullable(),
  drafts: z.array(EssayDraftDto),
  feedback: z.array(EssayFeedbackDto),
});
export type EssayDetailDto = z.infer<typeof EssayDetailDto>;

export const RecommenderAssignmentDto = z.object({
  id: Uuid,
  application_id: Uuid,
  school_name: z.string(),
  deadline: IsoDate,
  status: z.enum(E.RECOMMENDER_ASSIGNMENT_STATUSES),
  invited_at: IsoDate.nullable(),
  submitted_at: IsoDate.nullable(),
  evidence: ItemEvidence.nullable(),
});
export const RecommenderDto = z.object({
  id: Uuid,
  name: z.string(),
  role: z.enum(E.RECOMMENDER_ROLES),
  email: z.string().nullable(),
  subject: z.string().nullable(),
  invite_status: z.enum(E.RECOMMENDER_INVITE_STATUSES),
  invited_at: IsoDate.nullable(),
  last_nudged_at: nullableDateTime,
  notes: z.string(),
  assignments: z.array(RecommenderAssignmentDto),
});
export type RecommenderDto = z.infer<typeof RecommenderDto>;

export const MessageDto = z.object({
  id: Uuid,
  conversation_kind: z.enum(E.CONVERSATION_KINDS),
  channel: z.enum(E.CHANNELS),
  direction: z.enum(E.DIRECTIONS),
  kind: z.enum(E.MESSAGE_KINDS),
  body: z.string(),
  media: z.array(MediaRef),
  reaction: z.string().nullable(),
  in_reply_to_id: Uuid.nullable(),
  delivery_status: z.enum(E.DELIVERY_STATUSES),
  proactive: z.boolean(),
  created_at: IsoDateTime,
});
export type MessageDto = z.infer<typeof MessageDto>;

export const ApprovalDto = z.object({
  id: Uuid,
  kind: z.enum(E.APPROVAL_KINDS),
  summary: z.string(),
  payload: ApprovalPayload,
  status: z.enum(E.APPROVAL_STATUSES),
  requested_via: z.enum(E.CHANNELS),
  answered_via: z.enum(E.CHANNELS).nullable(),
  answered_at: nullableDateTime,
  resulting_job_id: Uuid.nullable(),
  expires_at: IsoDateTime,
  created_at: IsoDateTime,
});
export type ApprovalDto = z.infer<typeof ApprovalDto>;

export const BrowserJobDto = z.object({
  id: Uuid,
  student_id: Uuid,
  kind: z.enum(E.BROWSER_JOB_KINDS),
  status: z.enum(E.BROWSER_JOB_STATUSES),
  provider: z.enum(E.BROWSER_PROVIDERS),
  replay_url: z.string().nullable(),
  screenshots: z.array(z.object({ page: z.string(), url: z.string(), taken_at: IsoDateTime })),
  result: BrowserJobResult.nullable(),
  error: z.string().nullable(),
  attempts: z.number().int(),
  started_at: nullableDateTime,
  finished_at: nullableDateTime,
  created_at: IsoDateTime,
});
export type BrowserJobDto = z.infer<typeof BrowserJobDto>;

export const AgentRunDto = z.object({
  id: Uuid,
  trigger: z.enum(E.RUN_TRIGGERS),
  model: z.string(),
  tools_called: z.array(ToolCallRecord),
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
  duration_ms: z.number().int(),
  outcome: z.enum(E.RUN_OUTCOMES),
  error: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: IsoDateTime,
});
export type AgentRunDto = z.infer<typeof AgentRunDto>;

export const AuditEntryDto = z.object({
  id: Uuid,
  actor: z.enum(E.AUDIT_ACTORS),
  action: z.string(),
  entity_type: z.string().nullable(),
  entity_id: Uuid.nullable(),
  details: z.record(z.string(), z.unknown()),
  replay_url: z.string().nullable(),
  created_at: IsoDateTime,
});
export type AuditEntryDto = z.infer<typeof AuditEntryDto>;

export const SnapshotSummaryDto = z.object({
  id: Uuid,
  created_at: IsoDateTime,
  overall_confidence: z.number(),
  low_confidence_sections: z.array(z.string()),
  changes: z.array(StateChange),
});

export const TimelineEntryDto = z.object({
  date: IsoDate,
  days_remaining: z.number().int(),
  title: z.string(),
  kind: z.enum(['application_deadline', 'item_due', 'aid_deadline', 'custom']),
  application_id: Uuid.nullable(),
  application_item_id: Uuid.nullable(),
  school_name: z.string().nullable(),
  status: z.enum(E.ITEM_STATUSES).nullable(),
});
export type TimelineEntryDto = z.infer<typeof TimelineEntryDto>;

export const OverviewDto = z.object({
  today: IsoDate,
  nearest_deadline: z
    .object({ school_name: z.string(), plan: z.enum(E.APPLICATION_PLANS), date: IsoDate, days_remaining: z.number().int() })
    .nullable(),
  applications_count: z.number().int(),
  items_open: z.number().int(),
  items_done: z.number().int(),
  changes_since_yesterday: z.array(StateChange),
  last_synced_at: nullableDateTime,
  sync_paused_reason: z.string().nullable(),
  pending_approvals: z.number().int(),
  weekly_plan: WeeklyPlan.nullable(),
});
export type OverviewDto = z.infer<typeof OverviewDto>;

export const CredentialStatusDto = z.object({
  provider: z.enum(E.CREDENTIAL_PROVIDERS),
  connected: z.boolean(),
  status: z.enum(E.CREDENTIAL_STATUSES).nullable(),
  username: z.string().nullable(),
  verified_at: nullableDateTime,
  last_used_at: nullableDateTime,
  failure_count: z.number().int(),
});

export const SyncStatusDto = z.object({
  last_synced_at: nullableDateTime,
  last_job: BrowserJobDto.nullable(),
  awaiting_verification_job_id: Uuid.nullable(),
  credentials: CredentialStatusDto,
  sync_paused_reason: z.string().nullable(),
});
export type SyncStatusDto = z.infer<typeof SyncStatusDto>;

export const SettingsDto = z.object({
  phone_e164: z.string().nullable(),
  timezone: z.string(),
  quiet_hours: QuietHours,
  nudge_intensity: z.enum(E.NUDGE_INTENSITIES),
  agent_name: z.string(),
  agent_phone_number: z.string(),
  connected_accounts: z.array(CredentialStatusDto),
  features: z.object({ gmail: z.boolean() }),
});
export type SettingsDto = z.infer<typeof SettingsDto>;

export const OnboardingStateDto = z.object({
  step: z.number().int().min(1).max(7),
  completed: z.boolean(),
  student: StudentDto,
  profile: StudentProfileDto.nullable(),
  activities: z.array(ActivityDto),
  narrative: NarrativeDto.nullable(),
  applications: z.array(ApplicationDto),
  credentials: CredentialStatusDto,
  agent_phone_number: z.string(),
  agent_name: z.string(),
  privacy_url: z.string(),
});
export type OnboardingStateDto = z.infer<typeof OnboardingStateDto>;

export const AdminStudentDto = z.object({
  student: StudentDto,
  applications_count: z.number().int(),
  open_items: z.number().int(),
  last_synced_at: nullableDateTime,
  last_job_status: z.enum(E.BROWSER_JOB_STATUSES).nullable(),
  failed_jobs_24h: z.number().int(),
  tokens_30d: z.object({ input: z.number().int(), output: z.number().int() }),
  browser_minutes_30d: z.number(),
});
export const QueueHealthDto = z.object({
  queue: z.string(),
  waiting: z.number().int(),
  active: z.number().int(),
  delayed: z.number().int(),
  failed: z.number().int(),
  completed: z.number().int(),
});
export const DriftAlertDto = z.object({
  id: Uuid,
  section: z.string(),
  confidence: z.number(),
  details: z.record(z.string(), z.unknown()),
  browser_job_id: Uuid.nullable(),
  status: z.enum(E.DRIFT_STATUSES),
  created_at: IsoDateTime,
  resolved_at: nullableDateTime,
});
export const CostReportDto = z.object({
  students: z.array(
    z.object({
      student_id: Uuid,
      name: z.string(),
      input_tokens: z.number().int(),
      output_tokens: z.number().int(),
      estimated_llm_usd: z.number(),
      browser_minutes: z.number(),
      runs: z.number().int(),
      jobs: z.number().int(),
    }),
  ),
  since: IsoDateTime,
});
