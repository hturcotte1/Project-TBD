/**
 * The HTTP contract between apps/web and apps/api. Each entry declares method, path, and zod
 * schemas for params/query/body/response. apps/api must implement every key (the type system
 * enforces exhaustiveness); apps/web calls them through the typed client in ./client.ts.
 */
import { z } from 'zod';
import * as E from '../domain/enums';
import { Academics, ActivityList, Demographics, Goals, QuietHours, StudentNarrative, TestScores, TranscriptExtraction } from '../schemas';
import { IsoDate, Uuid } from '../schemas/common';
import * as D from './dto';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type RouteAuth = 'public' | 'student' | 'admin';

export interface RouteDef<
  P extends z.ZodTypeAny = z.ZodTypeAny,
  Q extends z.ZodTypeAny = z.ZodTypeAny,
  B extends z.ZodTypeAny = z.ZodTypeAny,
  R extends z.ZodTypeAny = z.ZodTypeAny,
> {
  method: HttpMethod;
  /** Fastify-style path with :params. */
  path: string;
  auth: RouteAuth;
  params: P;
  query: Q;
  body: B;
  response: R;
  /** Human summary for docs and logs. */
  summary: string;
}

const Empty = z.object({});
const Ok = z.object({ ok: z.literal(true) });
const IdParam = z.object({ id: Uuid });

function route<P extends z.ZodTypeAny, Q extends z.ZodTypeAny, B extends z.ZodTypeAny, R extends z.ZodTypeAny>(def: {
  method: HttpMethod;
  path: string;
  auth?: RouteAuth;
  params?: P;
  query?: Q;
  body?: B;
  response: R;
  summary: string;
}): RouteDef<P, Q, B, R> {
  return {
    method: def.method,
    path: def.path,
    auth: def.auth ?? 'student',
    params: (def.params ?? Empty) as P,
    query: (def.query ?? Empty) as Q,
    body: (def.body ?? Empty) as B,
    response: def.response,
    summary: def.summary,
  };
}

const Pagination = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const OnboardingStepBody = z.discriminatedUnion('step', [
  z.object({
    step: z.literal(1),
    data: z.object({
      first_name: z.string().min(1).max(80),
      last_name: z.string().min(1).max(80),
      preferred_name: z.string().max(80).default(''),
      phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
      high_school: z.string().min(1).max(200),
      graduation_year: z.number().int().min(2025).max(2030),
      timezone: z.string().min(1),
      quiet_hours: QuietHours,
      nudge_intensity: z.enum(E.NUDGE_INTENSITIES),
    }),
  }),
  z.object({
    step: z.literal(2),
    data: z.object({ academics: Academics, test_scores: TestScores }),
  }),
  z.object({ step: z.literal(3), data: z.object({ activities: ActivityList }) }),
  z.object({ step: z.literal(4), data: z.object({ narrative_confirmed: z.boolean() }) }),
  z.object({
    step: z.literal(5),
    data: z.object({
      goals: Goals,
      demographics: Demographics,
      applications: z
        .array(
          z.object({
            school_slug: z.string().optional(),
            school_name: z.string().min(1).max(200).optional(),
            plan: z.enum(E.APPLICATION_PLANS),
            self_assessment: z.enum(E.SELF_ASSESSMENTS).nullable().default(null),
          }),
        )
        .min(1)
        .max(30),
    }),
  }),
  z.object({ step: z.literal(6), data: z.object({ acknowledged: z.boolean() }) }),
  z.object({ step: z.literal(7), data: z.object({}) }),
]);
export type OnboardingStepBody = z.infer<typeof OnboardingStepBody>;

export const api = {
  // ----- health / identity -----
  health: route({ method: 'GET', path: '/health', auth: 'public', response: z.object({ ok: z.literal(true), version: z.string() }), summary: 'Liveness' }),
  me: route({ method: 'GET', path: '/me', response: D.StudentDto, summary: 'Current student' }),

  // ----- onboarding -----
  onboardingGet: route({ method: 'GET', path: '/onboarding', response: D.OnboardingStateDto, summary: 'Onboarding state and saved data' }),
  onboardingStep: route({ method: 'POST', path: '/onboarding/step', body: OnboardingStepBody, response: D.OnboardingStateDto, summary: 'Save a step and advance' }),
  onboardingComplete: route({ method: 'POST', path: '/onboarding/complete', response: D.OnboardingStateDto, summary: 'Finish onboarding: first sync + first plan' }),

  // ----- overview -----
  overview: route({ method: 'GET', path: '/overview', response: D.OverviewDto, summary: 'Home page summary' }),

  // ----- profile -----
  profileGet: route({
    method: 'GET',
    path: '/profile',
    response: z.object({ student: D.StudentDto, profile: D.StudentProfileDto, activities: z.array(D.ActivityDto), narrative: D.NarrativeDto.nullable() }),
    summary: 'Everything from onboarding',
  }),
  profileUpdateBasics: route({
    method: 'PUT',
    path: '/profile/basics',
    body: z.object({
      first_name: z.string().min(1).max(80).optional(),
      last_name: z.string().min(1).max(80).optional(),
      preferred_name: z.string().max(80).optional(),
      high_school: z.string().max(200).optional(),
      graduation_year: z.number().int().min(2025).max(2030).optional(),
    }),
    response: D.StudentDto,
    summary: 'Update name/school',
  }),
  profileUpdateAcademics: route({ method: 'PUT', path: '/profile/academics', body: Academics, response: D.StudentProfileDto, summary: 'Update academics' }),
  profileUpdateTestScores: route({ method: 'PUT', path: '/profile/test-scores', body: TestScores, response: D.StudentProfileDto, summary: 'Update test scores' }),
  profileUpdateDemographics: route({ method: 'PUT', path: '/profile/demographics', body: Demographics, response: D.StudentProfileDto, summary: 'Update shared demographics' }),
  profileUpdateGoals: route({ method: 'PUT', path: '/profile/goals', body: Goals, response: D.StudentProfileDto, summary: 'Update goals' }),
  activitiesReplace: route({ method: 'PUT', path: '/activities', body: z.object({ activities: ActivityList }), response: z.array(D.ActivityDto), summary: 'Replace the ordered activity list (max 10)' }),
  narrativeGet: route({ method: 'GET', path: '/narrative', response: D.NarrativeDto.nullable(), summary: 'Latest narrative' }),
  narrativeUpdate: route({ method: 'PUT', path: '/narrative', body: StudentNarrative, response: D.NarrativeDto, summary: 'Student edits the narrative directly' }),
  narrativeRestartInterview: route({ method: 'POST', path: '/narrative/interview/restart', response: Ok, summary: 'Clear the interview thread and start over' }),
  narrativeSummarize: route({ method: 'POST', path: '/narrative/summarize', response: z.object({ run_id: Uuid }), summary: 'Build/refresh the StudentNarrative from the interview transcript' }),

  // ----- documents -----
  documentsList: route({ method: 'GET', path: '/documents', query: z.object({ kind: z.enum(E.DOCUMENT_KINDS).optional() }), response: z.array(D.DocumentDto), summary: 'List uploads' }),
  documentGet: route({ method: 'GET', path: '/documents/:id', params: IdParam, response: D.DocumentDto, summary: 'One document with extraction' }),
  documentExtract: route({ method: 'POST', path: '/documents/:id/extract', params: IdParam, response: D.DocumentDto, summary: 'Queue (re-)extraction' }),
  documentApplyTranscript: route({
    method: 'POST',
    path: '/documents/:id/apply-transcript',
    params: IdParam,
    body: TranscriptExtraction,
    response: D.StudentProfileDto,
    summary: 'Apply student-corrected transcript extraction to the profile',
  }),
  documentApplyActivities: route({
    method: 'POST',
    path: '/documents/:id/apply-activities',
    params: IdParam,
    body: z.object({ activities: ActivityList }),
    response: z.array(D.ActivityDto),
    summary: 'Apply student-corrected activity extraction',
  }),
  documentDelete: route({ method: 'DELETE', path: '/documents/:id', params: IdParam, response: Ok, summary: 'Delete an upload' }),

  // ----- schools & applications -----
  schoolsSearch: route({ method: 'GET', path: '/schools', query: z.object({ q: z.string().max(100).default('') }), response: z.array(D.SchoolWithRequirementsDto), summary: 'Search the school dataset' }),
  schoolGet: route({ method: 'GET', path: '/schools/:slug', params: z.object({ slug: z.string() }), response: D.SchoolWithRequirementsDto, summary: 'School with requirements' }),
  applicationsList: route({ method: 'GET', path: '/applications', response: z.array(D.ApplicationDto), summary: 'All applications with counts' }),
  applicationCreate: route({
    method: 'POST',
    path: '/applications',
    body: z.object({
      school_slug: z.string().optional(),
      school_name: z.string().min(1).max(200).optional(),
      plan: z.enum(E.APPLICATION_PLANS),
      self_assessment: z.enum(E.SELF_ASSESSMENTS).nullable().default(null),
    }),
    response: D.ApplicationDto,
    summary: 'Add a school (known slug or free-text name)',
  }),
  applicationGet: route({ method: 'GET', path: '/applications/:id', params: IdParam, response: D.ApplicationDetailDto, summary: 'Application with full checklist' }),
  applicationUpdate: route({
    method: 'PATCH',
    path: '/applications/:id',
    params: IdParam,
    body: z.object({
      plan: z.enum(E.APPLICATION_PLANS).optional(),
      self_assessment: z.enum(E.SELF_ASSESSMENTS).nullable().optional(),
      status: z.enum(E.APPLICATION_STATUSES).optional(),
      decision: z.enum(E.DECISION_OUTCOMES).nullable().optional(),
      notes: z.string().max(2000).optional(),
    }),
    response: D.ApplicationDto,
    summary: 'Update plan/status/notes',
  }),
  applicationDelete: route({ method: 'DELETE', path: '/applications/:id', params: IdParam, response: Ok, summary: 'Remove a school' }),

  // ----- items -----
  itemsList: route({ method: 'GET', path: '/items', query: z.object({ application_id: Uuid.optional(), status: z.enum(E.ITEM_STATUSES).optional() }), response: z.array(D.ApplicationItemDto), summary: 'Checklist items' }),
  itemCreate: route({
    method: 'POST',
    path: '/items',
    body: z.object({
      application_id: Uuid.nullable().default(null),
      title: z.string().min(1).max(200),
      description: z.string().max(1000).default(''),
      due_date: IsoDate.nullable().default(null),
    }),
    response: D.ApplicationItemDto,
    summary: 'Add a custom item',
  }),
  itemUpdate: route({
    method: 'PATCH',
    path: '/items/:id',
    params: IdParam,
    body: z.object({ status: z.enum(E.ITEM_STATUSES).optional(), notes: z.string().max(2000).optional(), due_date: IsoDate.nullable().optional() }),
    response: D.ApplicationItemDto,
    summary: 'Student edits an item',
  }),
  itemDelete: route({ method: 'DELETE', path: '/items/:id', params: IdParam, response: Ok, summary: 'Delete a custom item' }),

  // ----- next actions -----
  nextActionsList: route({ method: 'GET', path: '/next-actions', query: z.object({ include_closed: z.coerce.boolean().default(false) }), response: z.array(D.NextActionDto), summary: 'Ordered next actions' }),
  nextActionUpdate: route({
    method: 'PATCH',
    path: '/next-actions/:id',
    params: IdParam,
    body: z.object({ status: z.enum(E.NEXT_ACTION_STATUSES), snoozed_until: z.string().datetime({ offset: true }).nullable().optional() }),
    response: D.NextActionDto,
    summary: 'Done / snooze / dismiss',
  }),
  nextActionsRecompute: route({ method: 'POST', path: '/next-actions/recompute', response: z.array(D.NextActionDto), summary: 'Recompute synchronously' }),

  // ----- timeline -----
  timeline: route({ method: 'GET', path: '/timeline', response: z.array(D.TimelineEntryDto), summary: 'Every deadline across schools' }),
  timelineIcs: route({ method: 'GET', path: '/timeline.ics', response: z.string(), summary: 'iCalendar export (text/calendar)' }),

  // ----- essays -----
  essaysList: route({ method: 'GET', path: '/essays', response: z.array(D.EssayDto), summary: 'Every essay across schools' }),
  essayGet: route({ method: 'GET', path: '/essays/:id', params: IdParam, response: D.EssayDetailDto, summary: 'Essay with drafts and feedback' }),
  essaySaveDraft: route({
    method: 'POST',
    path: '/essays/:id/drafts',
    params: IdParam,
    body: z.object({ content: z.string().max(50_000), mode: z.enum(['autosave', 'version']) }),
    response: D.EssayDetailDto,
    summary: 'Autosave updates the current draft; version creates a new one',
  }),
  essayRequestFeedback: route({ method: 'POST', path: '/essays/:id/feedback', params: IdParam, response: z.object({ run_id: Uuid }), summary: 'Queue feedback on the current draft' }),

  // ----- recommenders -----
  recommendersList: route({ method: 'GET', path: '/recommenders', response: z.array(D.RecommenderDto), summary: 'Recommenders with per-school status' }),
  recommenderCreate: route({
    method: 'POST',
    path: '/recommenders',
    body: z.object({
      name: z.string().min(1).max(120),
      role: z.enum(E.RECOMMENDER_ROLES),
      email: z.string().email().nullable().default(null),
      subject: z.string().max(80).nullable().default(null),
      application_ids: z.array(Uuid).default([]),
    }),
    response: D.RecommenderDto,
    summary: 'Add a recommender',
  }),
  recommenderUpdate: route({
    method: 'PATCH',
    path: '/recommenders/:id',
    params: IdParam,
    body: z.object({
      name: z.string().min(1).max(120).optional(),
      email: z.string().email().nullable().optional(),
      subject: z.string().max(80).nullable().optional(),
      invite_status: z.enum(E.RECOMMENDER_INVITE_STATUSES).optional(),
      invited_at: IsoDate.nullable().optional(),
      notes: z.string().max(2000).optional(),
      application_ids: z.array(Uuid).optional(),
    }),
    response: D.RecommenderDto,
    summary: 'Update a recommender and their schools',
  }),
  recommenderDelete: route({ method: 'DELETE', path: '/recommenders/:id', params: IdParam, response: Ok, summary: 'Remove a recommender' }),
  recommenderReminderDraft: route({ method: 'POST', path: '/recommenders/:id/reminder-draft', params: IdParam, response: z.object({ run_id: Uuid }), summary: 'Draft a polite reminder for the student to send' }),

  // ----- conversations -----
  messagesList: route({
    method: 'GET',
    path: '/conversations/:kind/messages',
    params: z.object({ kind: z.enum(E.CONVERSATION_KINDS) }),
    query: z.object({ after: z.string().datetime({ offset: true }).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
    response: z.array(D.MessageDto),
    summary: 'Thread (shared with iMessage for kind=main)',
  }),
  messageSend: route({
    method: 'POST',
    path: '/conversations/:kind/messages',
    params: z.object({ kind: z.enum(E.CONVERSATION_KINDS) }),
    body: z.object({ body: z.string().min(1).max(5000) }),
    response: D.MessageDto,
    summary: 'Student sends from the dashboard; agent reply arrives asynchronously',
  }),

  // ----- approvals -----
  approvalsList: route({ method: 'GET', path: '/approvals', query: z.object({ status: z.enum(E.APPROVAL_STATUSES).optional() }), response: z.array(D.ApprovalDto), summary: 'Approvals' }),
  approvalAnswer: route({ method: 'POST', path: '/approvals/:id/answer', params: IdParam, body: z.object({ approve: z.boolean() }), response: D.ApprovalDto, summary: 'Approve or reject' }),
  approvalProposeFill: route({
    method: 'POST',
    path: '/approvals/propose-fill',
    body: z.object({ section: z.enum(['activities', 'college_questions', 'personal_essay', 'profile']), school_slug: z.string().nullable().default(null) }),
    response: D.ApprovalDto,
    summary: 'Build a fill-fields proposal from the student\'s own data',
  }),

  // ----- sync / credentials -----
  syncStatus: route({ method: 'GET', path: '/sync/status', response: D.SyncStatusDto, summary: 'Sync + connection status' }),
  syncRun: route({ method: 'POST', path: '/sync/run', response: D.BrowserJobDto, summary: 'Queue a full sync now' }),
  credentialsConnectCommonApp: route({
    method: 'POST',
    path: '/credentials/common-app',
    body: z.object({ email: z.string().email(), password: z.string().min(1).max(200) }),
    response: D.BrowserJobDto,
    summary: 'Store encrypted credentials and queue verification',
  }),
  credentialsDisconnectCommonApp: route({ method: 'DELETE', path: '/credentials/common-app', response: Ok, summary: 'Delete credentials, cancel browser jobs' }),
  verificationCodeSubmit: route({ method: 'POST', path: '/verification-code', body: z.object({ code: z.string().min(4).max(12) }), response: Ok, summary: 'Hand a Common App code to the waiting browser job' }),

  // ----- activity / audit -----
  activityFeed: route({ method: 'GET', path: '/activity', query: Pagination, response: z.object({ items: z.array(D.AuditEntryDto), next_cursor: z.string().nullable() }), summary: 'Everything the agent did and saw' }),
  browserJobsList: route({ method: 'GET', path: '/browser-jobs', query: Pagination, response: z.array(D.BrowserJobDto), summary: 'Browser jobs with replay links' }),
  agentRunsList: route({ method: 'GET', path: '/agent-runs', query: Pagination, response: z.array(D.AgentRunDto), summary: 'Agent runs' }),
  agentRunGet: route({ method: 'GET', path: '/agent-runs/:id', params: IdParam, response: D.AgentRunDto, summary: 'Poll a run (feedback, reminder draft, summary)' }),
  snapshotsList: route({ method: 'GET', path: '/snapshots', query: Pagination, response: z.array(D.SnapshotSummaryDto), summary: 'Sync snapshots and diffs' }),

  // ----- settings / account -----
  settingsGet: route({ method: 'GET', path: '/settings', response: D.SettingsDto, summary: 'Settings' }),
  settingsUpdate: route({
    method: 'PUT',
    path: '/settings',
    body: z.object({
      phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
      timezone: z.string().optional(),
      quiet_hours: QuietHours.optional(),
      nudge_intensity: z.enum(E.NUDGE_INTENSITIES).optional(),
    }),
    response: D.SettingsDto,
    summary: 'Update settings',
  }),
  accountExport: route({ method: 'POST', path: '/account/export', response: z.object({ run_id: Uuid }), summary: 'Queue a data export' }),
  accountExportDownload: route({ method: 'GET', path: '/account/export/:id', params: IdParam, response: z.unknown(), summary: 'Download a completed export (JSON)' }),
  accountDelete: route({ method: 'DELETE', path: '/account', body: z.object({ confirm: z.literal('DELETE') }), response: Ok, summary: 'Hard-delete everything' }),

  // ----- admin -----
  adminStudents: route({ method: 'GET', path: '/admin/students', auth: 'admin', response: z.array(D.AdminStudentDto), summary: 'All students' }),
  adminQueues: route({ method: 'GET', path: '/admin/queues', auth: 'admin', response: z.array(D.QueueHealthDto), summary: 'Queue health' }),
  adminJobs: route({ method: 'GET', path: '/admin/jobs', auth: 'admin', query: z.object({ status: z.enum(E.BROWSER_JOB_STATUSES).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), response: z.array(D.BrowserJobDto), summary: 'Browser jobs across students' }),
  adminDrift: route({ method: 'GET', path: '/admin/drift', auth: 'admin', response: z.array(D.DriftAlertDto), summary: 'Site-drift alerts' }),
  adminDriftResolve: route({ method: 'PATCH', path: '/admin/drift/:id', auth: 'admin', params: IdParam, body: z.object({ status: z.enum(E.DRIFT_STATUSES) }), response: D.DriftAlertDto, summary: 'Resolve an alert' }),
  adminSyncNow: route({ method: 'POST', path: '/admin/students/:id/sync', auth: 'admin', params: IdParam, response: D.BrowserJobDto, summary: 'Run sync for a student' }),
  adminCosts: route({ method: 'GET', path: '/admin/costs', auth: 'admin', response: D.CostReportDto, summary: 'Per-student tokens and browser minutes' }),
} as const;

export type Api = typeof api;
export type RouteKey = keyof Api;
export type RouteParams<K extends RouteKey> = z.infer<Api[K]['params']>;
export type RouteQuery<K extends RouteKey> = z.infer<Api[K]['query']>;
export type RouteBody<K extends RouteKey> = z.input<Api[K]['body']>;
export type RouteResponse<K extends RouteKey> = z.infer<Api[K]['response']>;

export interface RouteInput<K extends RouteKey> {
  params?: RouteParams<K>;
  query?: RouteQuery<K>;
  body?: RouteBody<K>;
}

/** Fill :params into a path. */
export function buildPath(path: string, params: Record<string, string> | undefined): string {
  return path.replace(/:([A-Za-z_]+)/g, (_, name: string) => {
    const v = params?.[name];
    if (v === undefined) throw new Error(`missing path param ${name} for ${path}`);
    return encodeURIComponent(v);
  });
}
