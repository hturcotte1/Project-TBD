/**
 * Every closed vocabulary in the system lives here, once. Drizzle pgEnums and zod enums are both
 * derived from these arrays so the database, the API, and the UI can never disagree.
 */

export const ROLES = ['student', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const STUDENT_STATUSES = ['active', 'paused', 'deleted'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const NUDGE_INTENSITIES = ['chill', 'normal', 'intense'] as const;
export type NudgeIntensity = (typeof NUDGE_INTENSITIES)[number];

export const APPLICATION_PLANS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'rolling'] as const;
export type ApplicationPlan = (typeof APPLICATION_PLANS)[number];

export const APPLICATION_STATUSES = [
  'not_started',
  'in_progress',
  'ready_to_submit',
  'submitted',
  'decision_received',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DECISION_OUTCOMES = ['accepted', 'rejected', 'deferred', 'waitlisted', 'withdrawn'] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

export const SELF_ASSESSMENTS = ['reach', 'target', 'safety'] as const;
export type SelfAssessment = (typeof SELF_ASSESSMENTS)[number];

export const ITEM_KINDS = [
  'common_app_section',
  'college_questions',
  'supplement_essay',
  'personal_essay',
  'teacher_rec',
  'counselor_rec',
  'other_rec',
  'ferpa',
  'test_scores',
  'score_send',
  'transcript',
  'midyear_report',
  'school_report',
  'fafsa',
  'css_profile',
  'application_fee',
  'fee_waiver',
  'interview',
  'portfolio',
  'review_submit',
  'custom',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_SOURCES = ['common_app', 'school_portal', 'internal_rule', 'student'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

export const ITEM_STATUSES = ['missing', 'in_progress', 'done', 'not_applicable', 'blocked'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const EFFORT_LEVELS = ['small', 'medium', 'large'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const DOCUMENT_KINDS = ['transcript', 'resume', 'essay_draft', 'screenshot', 'photo', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const EXTRACTION_STATUSES = ['pending', 'processing', 'done', 'failed', 'not_applicable'] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const DOCUMENT_SOURCES = ['dashboard', 'imessage', 'system'] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

/** Common App's activity type list (2026-27). */
export const ACTIVITY_TYPES = [
  'academic',
  'art',
  'athletics_club',
  'athletics_jv_varsity',
  'career_oriented',
  'community_service',
  'computer_technology',
  'cultural',
  'dance',
  'debate_speech',
  'environmental',
  'family_responsibilities',
  'foreign_exchange',
  'foreign_language',
  'internship',
  'journalism_publication',
  'junior_rotc',
  'lgbtq',
  'music_instrumental',
  'music_vocal',
  'other_club',
  'religious',
  'research',
  'robotics',
  'school_spirit',
  'science_math',
  'social_justice',
  'student_government',
  'theater_drama',
  'work_paid',
  'other',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const GRADE_LEVELS = ['9', '10', '11', '12', 'PG'] as const;
export type GradeLevel = (typeof GRADE_LEVELS)[number];

export const ACTIVITY_TIMINGS = ['school_year', 'school_break', 'all_year'] as const;
export type ActivityTiming = (typeof ACTIVITY_TIMINGS)[number];

export const RECOMMENDER_ROLES = ['teacher', 'counselor', 'other'] as const;
export type RecommenderRole = (typeof RECOMMENDER_ROLES)[number];

export const RECOMMENDER_INVITE_STATUSES = ['not_invited', 'invited', 'submitted'] as const;
export type RecommenderInviteStatus = (typeof RECOMMENDER_INVITE_STATUSES)[number];

export const RECOMMENDER_ASSIGNMENT_STATUSES = ['pending', 'invited', 'submitted'] as const;
export type RecommenderAssignmentStatus = (typeof RECOMMENDER_ASSIGNMENT_STATUSES)[number];

export const NEXT_ACTION_STATUSES = ['open', 'done', 'snoozed', 'dismissed'] as const;
export type NextActionStatus = (typeof NEXT_ACTION_STATUSES)[number];

export const CONVERSATION_KINDS = ['main', 'interview'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const CHANNELS = ['imessage', 'dashboard', 'system'] as const;
export type Channel = (typeof CHANNELS)[number];

export const DIRECTIONS = ['inbound', 'outbound'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const MESSAGE_KINDS = ['text', 'media', 'reaction', 'system_note'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const DELIVERY_STATUSES = ['queued', 'sent', 'delivered', 'read', 'failed'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const RUN_TRIGGERS = [
  'inbound_message',
  'schedule',
  'sync_diff',
  'manual',
  'proactive',
  'essay_feedback',
  'extraction',
  'interview',
  'weekly_plan',
  'approval',
  'reminder_draft',
] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export const RUN_OUTCOMES = ['pending', 'running', 'completed', 'failed', 'refused', 'no_action'] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const APPROVAL_KINDS = ['fill_fields', 'submit', 'custom'] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'executed', 'failed'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const BROWSER_JOB_KINDS = ['verify_credentials', 'full_sync', 'fill_fields', 'check_recommenders'] as const;
export type BrowserJobKind = (typeof BROWSER_JOB_KINDS)[number];

export const BROWSER_JOB_STATUSES = [
  'queued',
  'running',
  'awaiting_verification_code',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type BrowserJobStatus = (typeof BROWSER_JOB_STATUSES)[number];

export const BROWSER_PROVIDERS = ['browserbase', 'local'] as const;
export type BrowserProvider = (typeof BROWSER_PROVIDERS)[number];

export const AUDIT_ACTORS = ['agent', 'student', 'system', 'admin'] as const;
export type AuditActor = (typeof AUDIT_ACTORS)[number];

export const CREDENTIAL_PROVIDERS = ['common_app', 'gmail'] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];

export const CREDENTIAL_STATUSES = ['active', 'invalid', 'deleted'] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const TEST_POLICIES = ['required', 'optional', 'blind', 'flexible'] as const;
export type TestPolicy = (typeof TEST_POLICIES)[number];

export const INTERVIEW_POLICIES = ['none', 'optional', 'recommended', 'required', 'by_invitation'] as const;
export type InterviewPolicy = (typeof INTERVIEW_POLICIES)[number];

export const NUDGE_KINDS = [
  'deadline_countdown',
  'deadline_day_of',
  'recommender_inactivity',
  'essay_staleness',
  'score_send_cutoff',
  'morning_plan',
  'weekly_plan',
  'sync_change',
  'custom',
] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export const SCHOOL_TYPES = ['public', 'private'] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const DRIFT_STATUSES = ['open', 'resolved'] as const;
export type DriftStatus = (typeof DRIFT_STATUSES)[number];

export const AUTONOMY_LEVELS = ['B', 'C'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const REQUIREMENT_SOURCES = ['internal_dataset', 'common_app_verified', 'student'] as const;
export type RequirementSource = (typeof REQUIREMENT_SOURCES)[number];

export const TEST_OPTIONAL_STANCES = ['submit_all', 'submit_selectively', 'go_test_optional', 'undecided'] as const;
export type TestOptionalStance = (typeof TEST_OPTIONAL_STANCES)[number];

export const COST_SENSITIVITIES = ['low', 'medium', 'high'] as const;
export type CostSensitivity = (typeof COST_SENSITIVITIES)[number];

export const SCHOOL_SIZES = ['small', 'medium', 'large'] as const;
export type SchoolSize = (typeof SCHOOL_SIZES)[number];

export const STATE_CHANGE_KINDS = [
  'college_added',
  'college_removed',
  'section_status',
  'writing_status',
  'college_questions_status',
  'supplement_status',
  'recommender_status',
  'ferpa_status',
  'submission_status',
  'deadline_changed',
  'plan_changed',
  'fee_status',
  'test_scores',
] as const;
export type StateChangeKind = (typeof STATE_CHANGE_KINDS)[number];

export const SIGNIFICANCES = ['info', 'notable', 'important'] as const;
export type Significance = (typeof SIGNIFICANCES)[number];

export const ONBOARDING_STEP_COUNT = 7;
