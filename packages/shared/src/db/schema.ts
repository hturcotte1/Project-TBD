/**
 * Database schema. One table per aggregate; every student-owned table carries student_id so
 * repositories can scope every query. JSONB columns are typed with the zod-inferred types from
 * ../schemas so the DB, API, and UI share one definition.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import * as E from '../domain/enums';
import type {
  Academics,
  ApprovalPayload,
  BrowserJobResult,
  CommonAppSnapshot,
  Demographics,
  DocumentExtraction,
  EssayFeedback,
  Goals,
  ItemEvidence,
  MediaRef,
  ScreenshotRef,
  StateChange,
  StudentNarrative,
  TestScores,
  ToolCallRecord,
  WeeklyPlan,
} from '../schemas';
import type { ActivityTiming, GradeLevel } from '../domain/enums';
import type { SchoolRequirementsData } from '../schemas/requirements';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// ---------- enums ----------
export const roleEnum = pgEnum('role', E.ROLES);
export const studentStatusEnum = pgEnum('student_status', E.STUDENT_STATUSES);
export const nudgeIntensityEnum = pgEnum('nudge_intensity', E.NUDGE_INTENSITIES);
export const applicationPlanEnum = pgEnum('application_plan', E.APPLICATION_PLANS);
export const applicationStatusEnum = pgEnum('application_status', E.APPLICATION_STATUSES);
export const decisionOutcomeEnum = pgEnum('decision_outcome', E.DECISION_OUTCOMES);
export const selfAssessmentEnum = pgEnum('self_assessment', E.SELF_ASSESSMENTS);
export const itemKindEnum = pgEnum('item_kind', E.ITEM_KINDS);
export const itemSourceEnum = pgEnum('item_source', E.ITEM_SOURCES);
export const itemStatusEnum = pgEnum('item_status', E.ITEM_STATUSES);
export const effortEnum = pgEnum('effort_level', E.EFFORT_LEVELS);
export const documentKindEnum = pgEnum('document_kind', E.DOCUMENT_KINDS);
export const extractionStatusEnum = pgEnum('extraction_status', E.EXTRACTION_STATUSES);
export const documentSourceEnum = pgEnum('document_source', E.DOCUMENT_SOURCES);
export const activityTypeEnum = pgEnum('activity_type', E.ACTIVITY_TYPES);
export const recommenderRoleEnum = pgEnum('recommender_role', E.RECOMMENDER_ROLES);
export const recommenderInviteStatusEnum = pgEnum('recommender_invite_status', E.RECOMMENDER_INVITE_STATUSES);
export const recommenderAssignmentStatusEnum = pgEnum(
  'recommender_assignment_status',
  E.RECOMMENDER_ASSIGNMENT_STATUSES,
);
export const nextActionStatusEnum = pgEnum('next_action_status', E.NEXT_ACTION_STATUSES);
export const conversationKindEnum = pgEnum('conversation_kind', E.CONVERSATION_KINDS);
export const channelEnum = pgEnum('channel', E.CHANNELS);
export const directionEnum = pgEnum('direction', E.DIRECTIONS);
export const messageKindEnum = pgEnum('message_kind', E.MESSAGE_KINDS);
export const deliveryStatusEnum = pgEnum('delivery_status', E.DELIVERY_STATUSES);
export const runTriggerEnum = pgEnum('run_trigger', E.RUN_TRIGGERS);
export const runOutcomeEnum = pgEnum('run_outcome', E.RUN_OUTCOMES);
export const approvalKindEnum = pgEnum('approval_kind', E.APPROVAL_KINDS);
export const approvalStatusEnum = pgEnum('approval_status', E.APPROVAL_STATUSES);
export const browserJobKindEnum = pgEnum('browser_job_kind', E.BROWSER_JOB_KINDS);
export const browserJobStatusEnum = pgEnum('browser_job_status', E.BROWSER_JOB_STATUSES);
export const browserProviderEnum = pgEnum('browser_provider', E.BROWSER_PROVIDERS);
export const auditActorEnum = pgEnum('audit_actor', E.AUDIT_ACTORS);
export const credentialProviderEnum = pgEnum('credential_provider', E.CREDENTIAL_PROVIDERS);
export const credentialStatusEnum = pgEnum('credential_status', E.CREDENTIAL_STATUSES);
export const nudgeKindEnum = pgEnum('nudge_kind', E.NUDGE_KINDS);
export const schoolTypeEnum = pgEnum('school_type', E.SCHOOL_TYPES);
export const driftStatusEnum = pgEnum('drift_status', E.DRIFT_STATUSES);

// ---------- students ----------
export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: text('auth_user_id').unique(),
    email: text('email').notNull(),
    role: roleEnum('role').notNull().default('student'),
    status: studentStatusEnum('status').notNull().default('active'),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    preferredName: text('preferred_name').notNull().default(''),
    phoneE164: text('phone_e164'),
    highSchool: text('high_school').notNull().default(''),
    graduationYear: integer('graduation_year'),
    timezone: text('timezone').notNull().default('America/New_York'),
    quietHoursStart: text('quiet_hours_start').notNull().default('22:00'),
    quietHoursEnd: text('quiet_hours_end').notNull().default('07:00'),
    nudgeIntensity: nudgeIntensityEnum('nudge_intensity').notNull().default('normal'),
    onboardingStep: integer('onboarding_step').notNull().default(1),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    /** Set when browser jobs fail 3× in a row; cleared on reconnect. */
    syncPausedReason: text('sync_paused_reason'),
    /** Proactive messages are held until this time (set by "leave me alone tonight"). */
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    welcomeSentAt: timestamp('welcome_sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('students_phone_idx').on(t.phoneE164), index('students_email_idx').on(t.email)],
);

export const studentProfiles = pgTable('student_profiles', {
  studentId: uuid('student_id')
    .primaryKey()
    .references(() => students.id, { onDelete: 'cascade' }),
  academics: jsonb('academics').$type<Academics>().notNull(),
  testScores: jsonb('test_scores').$type<TestScores>().notNull(),
  demographics: jsonb('demographics').$type<Demographics>().notNull(),
  goals: jsonb('goals').$type<Goals>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const studentNarratives = pgTable(
  'student_narratives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(1),
    narrative: jsonb('narrative').$type<StudentNarrative>().notNull(),
    interviewConversationId: uuid('interview_conversation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('narratives_student_idx').on(t.studentId, t.version)],
);

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    activityType: activityTypeEnum('activity_type').notNull(),
    positionTitle: text('position_title').notNull(),
    organization: text('organization').notNull(),
    description: text('description').notNull(),
    gradeLevels: jsonb('grade_levels').$type<GradeLevel[]>().notNull(),
    timing: jsonb('timing').$type<ActivityTiming[]>().notNull(),
    hoursPerWeek: numeric('hours_per_week', { precision: 5, scale: 1 }).notNull(),
    weeksPerYear: integer('weeks_per_year').notNull(),
    continueInCollege: boolean('continue_in_college').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('activities_student_position_idx').on(t.studentId, t.position)],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    source: documentSourceEnum('source').notNull().default('dashboard'),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    extractionStatus: extractionStatusEnum('extraction_status').notNull().default('pending'),
    extraction: jsonb('extraction').$type<DocumentExtraction>(),
    extractionError: text('extraction_error'),
    messageId: uuid('message_id'),
    ...timestamps,
  },
  (t) => [index('documents_student_idx').on(t.studentId, t.createdAt)],
);

// ---------- schools & requirements ----------
export const schools = pgTable(
  'schools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    ceebCode: text('ceeb_code'),
    commonAppMember: boolean('common_app_member').notNull().default(true),
    portalUrl: text('portal_url'),
    website: text('website'),
    city: text('city').notNull().default(''),
    state: text('state').notNull().default(''),
    type: schoolTypeEnum('type').notNull().default('private'),
    /** Alternate names the reader may see on Common App, e.g. "UMich". */
    aliases: jsonb('aliases').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (t) => [index('schools_name_idx').on(t.name)],
);

export const schoolRequirements = pgTable(
  'school_requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    cycle: text('cycle').notNull(),
    data: jsonb('data').$type<SchoolRequirementsData>().notNull(),
    needsVerification: boolean('needs_verification').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('school_requirements_school_cycle_idx').on(t.schoolId, t.cycle)],
);

// ---------- applications ----------
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id),
    plan: applicationPlanEnum('plan').notNull(),
    /** Resolved deadline date (from requirements, overridden by Common App if it disagrees). */
    deadline: date('deadline').notNull(),
    deadlineSource: text('deadline_source').notNull().default('internal_dataset'),
    status: applicationStatusEnum('status').notNull().default('not_started'),
    decision: decisionOutcomeEnum('decision'),
    selfAssessment: selfAssessmentEnum('self_assessment'),
    commonAppCollegeId: text('common_app_college_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [uniqueIndex('applications_student_school_idx').on(t.studentId, t.schoolId)],
);

export const applicationItems = pgTable(
  'application_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** Null for student-wide items (FAFSA, personal essay, Common App sections). */
    applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'cascade' }),
    /** Deterministic identity of the requirement, e.g. "supplement:why_us" or "teacher_rec:2". */
    ruleKey: text('rule_key').notNull(),
    kind: itemKindEnum('kind').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    source: itemSourceEnum('source').notNull(),
    status: itemStatusEnum('status').notNull().default('missing'),
    evidence: jsonb('evidence').$type<ItemEvidence>(),
    dueDate: date('due_date'),
    importance: integer('importance').notNull().default(50),
    effort: effortEnum('effort').notNull().default('medium'),
    /** True when someone other than the student must act (recommender, counselor, testing agency). */
    dependsOnOthers: boolean('depends_on_others').notNull().default(false),
    blocking: boolean('blocking').notNull().default(false),
    /** Student changed the status/notes by hand; sync must not overwrite. */
    studentEdited: boolean('student_edited').notNull().default(false),
    notes: text('notes').notNull().default(''),
    /** Related essay/recommender for quick joins. */
    essayId: uuid('essay_id'),
    recommenderId: uuid('recommender_id'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('application_items_identity_idx').on(t.studentId, t.applicationId, t.ruleKey),
    index('application_items_student_status_idx').on(t.studentId, t.status),
  ],
);

export const commonAppSnapshots = pgTable(
  'common_app_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    browserJobId: uuid('browser_job_id'),
    /** Raw per-page extraction output with confidence and raw text, for audit. */
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull(),
    normalized: jsonb('normalized').$type<CommonAppSnapshot>().notNull(),
    diff: jsonb('diff').$type<StateChange[]>().notNull().default(sql`'[]'::jsonb`),
    overallConfidence: numeric('overall_confidence', { precision: 4, scale: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('snapshots_student_idx').on(t.studentId, t.createdAt)],
);

// ---------- essays ----------
export const essays = pgTable(
  'essays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** Null for the Common App personal essay. */
    applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'cascade' }),
    applicationItemId: uuid('application_item_id'),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    wordLimit: integer('word_limit'),
    currentDraftId: uuid('current_draft_id'),
    ...timestamps,
  },
  (t) => [index('essays_student_idx').on(t.studentId)],
);

export const essayDrafts = pgTable(
  'essay_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    essayId: uuid('essay_id')
      .notNull()
      .references(() => essays.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    wordCount: integer('word_count').notNull(),
    /** Where the text came from. Always the student; enforced at the API/tool boundary. */
    source: text('source').notNull().default('dashboard_editor'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('essay_drafts_version_idx').on(t.essayId, t.version)],
);

export const essayFeedback = pgTable(
  'essay_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    essayId: uuid('essay_id')
      .notNull()
      .references(() => essays.id, { onDelete: 'cascade' }),
    essayDraftId: uuid('essay_draft_id')
      .notNull()
      .references(() => essayDrafts.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id'),
    feedback: jsonb('feedback').$type<EssayFeedback>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('essay_feedback_essay_idx').on(t.essayId, t.createdAt)],
);

// ---------- recommenders ----------
export const recommenders = pgTable(
  'recommenders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: recommenderRoleEnum('role').notNull(),
    email: text('email'),
    subject: text('subject'),
    inviteStatus: recommenderInviteStatusEnum('invite_status').notNull().default('not_invited'),
    invitedAt: date('invited_at'),
    lastNudgedAt: timestamp('last_nudged_at', { withTimezone: true }),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('recommenders_student_idx').on(t.studentId)],
);

export const recommenderAssignments = pgTable(
  'recommender_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    recommenderId: uuid('recommender_id')
      .notNull()
      .references(() => recommenders.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    status: recommenderAssignmentStatusEnum('status').notNull().default('pending'),
    invitedAt: date('invited_at'),
    submittedAt: date('submitted_at'),
    evidence: jsonb('evidence').$type<ItemEvidence>(),
    ...timestamps,
  },
  (t) => [uniqueIndex('recommender_assignments_idx').on(t.recommenderId, t.applicationId)],
);

// ---------- next actions ----------
export const nextActions = pgTable(
  'next_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    applicationItemId: uuid('application_item_id').references(() => applicationItems.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    priorityScore: numeric('priority_score', { precision: 7, scale: 3 }).notNull(),
    rank: integer('rank').notNull(),
    dueDate: date('due_date'),
    status: nextActionStatusEnum('status').notNull().default('open'),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    computedByRunId: uuid('computed_by_run_id'),
    ...timestamps,
  },
  (t) => [
    index('next_actions_student_status_idx').on(t.studentId, t.status, t.rank),
    uniqueIndex('next_actions_item_idx').on(t.studentId, t.applicationItemId),
  ],
);

// ---------- conversations ----------
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: conversationKindEnum('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('conversations_student_kind_idx').on(t.studentId, t.kind)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    direction: directionEnum('direction').notNull(),
    kind: messageKindEnum('kind').notNull().default('text'),
    body: text('body').notNull().default(''),
    media: jsonb('media').$type<MediaRef[]>().notNull().default(sql`'[]'::jsonb`),
    /** For reactions: the emoji; for other kinds null. */
    reaction: text('reaction'),
    inReplyToId: uuid('in_reply_to_id'),
    providerMessageId: text('provider_message_id'),
    deliveryStatus: deliveryStatusEnum('delivery_status').notNull().default('queued'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    agentRunId: uuid('agent_run_id'),
    /** True for proactive nudges so acknowledgements can be matched. */
    proactive: boolean('proactive').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_conversation_idx').on(t.conversationId, t.createdAt),
    uniqueIndex('messages_provider_id_idx').on(t.providerMessageId),
  ],
);

// ---------- agent runs, approvals, browser jobs, audit ----------
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    trigger: runTriggerEnum('trigger').notNull(),
    model: text('model').notNull(),
    toolsCalled: jsonb('tools_called').$type<ToolCallRecord[]>().notNull().default(sql`'[]'::jsonb`),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    outcome: runOutcomeEnum('outcome').notNull(),
    error: text('error'),
    approvalIds: jsonb('approval_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_runs_student_idx').on(t.studentId, t.createdAt)],
);

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: approvalKindEnum('kind').notNull(),
    summary: text('summary').notNull(),
    payload: jsonb('payload').$type<ApprovalPayload>().notNull(),
    status: approvalStatusEnum('status').notNull().default('pending'),
    requestedVia: channelEnum('requested_via').notNull(),
    answeredVia: channelEnum('answered_via'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    answerText: text('answer_text'),
    resultingJobId: uuid('resulting_job_id'),
    agentRunId: uuid('agent_run_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('approvals_student_status_idx').on(t.studentId, t.status)],
);

export const browserJobs = pgTable(
  'browser_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: browserJobKindEnum('kind').notNull(),
    status: browserJobStatusEnum('status').notNull().default('queued'),
    provider: browserProviderEnum('provider').notNull(),
    providerSessionId: text('provider_session_id'),
    replayUrl: text('replay_url'),
    screenshots: jsonb('screenshots').$type<ScreenshotRef[]>().notNull().default(sql`'[]'::jsonb`),
    approvalId: uuid('approval_id'),
    queueJobId: text('queue_job_id'),
    result: jsonb('result').$type<BrowserJobResult>(),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('browser_jobs_student_idx').on(t.studentId, t.createdAt), index('browser_jobs_status_idx').on(t.status)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    actor: auditActorEnum('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_student_idx').on(t.studentId, t.createdAt)],
);

/**
 * Encrypted credentials. Repositories select explicit columns; the ciphertext is only ever read by
 * the worker's credential service. `sessionCiphertext` holds the encrypted browser cookies.
 */
export const credentials = pgTable(
  'credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    provider: credentialProviderEnum('provider').notNull(),
    status: credentialStatusEnum('status').notNull().default('active'),
    /** Non-secret identifier shown in the UI (the Common App login email). */
    username: text('username').notNull(),
    ciphertext: bytea('ciphertext').notNull(),
    iv: bytea('iv').notNull(),
    authTag: bytea('auth_tag').notNull(),
    keyVersion: integer('key_version').notNull(),
    sessionCiphertext: bytea('session_ciphertext'),
    sessionIv: bytea('session_iv'),
    sessionAuthTag: bytea('session_auth_tag'),
    sessionKeyVersion: integer('session_key_version'),
    sessionUpdatedAt: timestamp('session_updated_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    failureCount: integer('failure_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('credentials_student_provider_idx').on(t.studentId, t.provider)],
);

export const nudges = pgTable(
  'nudges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: nudgeKindEnum('kind').notNull(),
    triggerKey: text('trigger_key').notNull(),
    applicationItemId: uuid('application_item_id'),
    applicationId: uuid('application_id'),
    messageId: uuid('message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  },
  (t) => [uniqueIndex('nudges_trigger_idx').on(t.studentId, t.triggerKey), index('nudges_sent_idx').on(t.studentId, t.sentAt)],
);

export const weeklyPlans = pgTable(
  'weekly_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    plan: jsonb('plan').$type<WeeklyPlan>().notNull(),
    agentRunId: uuid('agent_run_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('weekly_plans_week_idx').on(t.studentId, t.weekStart)],
);

export const siteDriftAlerts = pgTable(
  'site_drift_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    section: text('section').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    browserJobId: uuid('browser_job_id'),
    status: driftStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [index('drift_status_idx').on(t.status, t.createdAt)],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    /** Redacted payload for debugging (no media bytes, no secrets). */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('webhook_events_provider_id_idx').on(t.provider, t.providerEventId)],
);

// ---------- relations (for db.query.* convenience) ----------
export const studentsRelations = relations(students, ({ one, many }) => ({
  profile: one(studentProfiles, { fields: [students.id], references: [studentProfiles.studentId] }),
  applications: many(applications),
  items: many(applicationItems),
  recommenders: many(recommenders),
}));
export const applicationsRelations = relations(applications, ({ one, many }) => ({
  student: one(students, { fields: [applications.studentId], references: [students.id] }),
  school: one(schools, { fields: [applications.schoolId], references: [schools.id] }),
  items: many(applicationItems),
}));
export const applicationItemsRelations = relations(applicationItems, ({ one }) => ({
  application: one(applications, { fields: [applicationItems.applicationId], references: [applications.id] }),
}));
export const schoolsRelations = relations(schools, ({ many }) => ({ requirements: many(schoolRequirements) }));
export const schoolRequirementsRelations = relations(schoolRequirements, ({ one }) => ({
  school: one(schools, { fields: [schoolRequirements.schoolId], references: [schools.id] }),
}));
export const essaysRelations = relations(essays, ({ many }) => ({ drafts: many(essayDrafts), feedback: many(essayFeedback) }));
export const essayDraftsRelations = relations(essayDrafts, ({ one }) => ({
  essay: one(essays, { fields: [essayDrafts.essayId], references: [essays.id] }),
}));
export const recommendersRelations = relations(recommenders, ({ many }) => ({ assignments: many(recommenderAssignments) }));
export const recommenderAssignmentsRelations = relations(recommenderAssignments, ({ one }) => ({
  recommender: one(recommenders, { fields: [recommenderAssignments.recommenderId], references: [recommenders.id] }),
  application: one(applications, { fields: [recommenderAssignments.applicationId], references: [applications.id] }),
}));
export const conversationsRelations = relations(conversations, ({ many }) => ({ messages: many(messages) }));
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

// ---------- row types ----------
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type StudentNarrativeRow = typeof studentNarratives.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type School = typeof schools.$inferSelect;
export type NewSchool = typeof schools.$inferInsert;
export type SchoolRequirementsRow = typeof schoolRequirements.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationItem = typeof applicationItems.$inferSelect;
export type NewApplicationItem = typeof applicationItems.$inferInsert;
export type CommonAppSnapshotRow = typeof commonAppSnapshots.$inferSelect;
export type Essay = typeof essays.$inferSelect;
export type NewEssay = typeof essays.$inferInsert;
export type EssayDraft = typeof essayDrafts.$inferSelect;
export type EssayFeedbackRow = typeof essayFeedback.$inferSelect;
export type Recommender = typeof recommenders.$inferSelect;
export type NewRecommender = typeof recommenders.$inferInsert;
export type RecommenderAssignment = typeof recommenderAssignments.$inferSelect;
export type NextAction = typeof nextActions.$inferSelect;
export type NewNextAction = typeof nextActions.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type BrowserJob = typeof browserJobs.$inferSelect;
export type NewBrowserJob = typeof browserJobs.$inferInsert;
export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type Nudge = typeof nudges.$inferSelect;
export type WeeklyPlanRow = typeof weeklyPlans.$inferSelect;
export type SiteDriftAlert = typeof siteDriftAlerts.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
