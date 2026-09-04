CREATE TYPE "public"."activity_type" AS ENUM('academic', 'art', 'athletics_club', 'athletics_jv_varsity', 'career_oriented', 'community_service', 'computer_technology', 'cultural', 'dance', 'debate_speech', 'environmental', 'family_responsibilities', 'foreign_exchange', 'foreign_language', 'internship', 'journalism_publication', 'junior_rotc', 'lgbtq', 'music_instrumental', 'music_vocal', 'other_club', 'religious', 'research', 'robotics', 'school_spirit', 'science_math', 'social_justice', 'student_government', 'theater_drama', 'work_paid', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_plan" AS ENUM('ED', 'ED2', 'EA', 'REA', 'RD', 'rolling');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('not_started', 'in_progress', 'ready_to_submit', 'submitted', 'decision_received');--> statement-breakpoint
CREATE TYPE "public"."approval_kind" AS ENUM('fill_fields', 'submit', 'custom');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'executed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."audit_actor" AS ENUM('agent', 'student', 'system', 'admin');--> statement-breakpoint
CREATE TYPE "public"."browser_job_kind" AS ENUM('verify_credentials', 'full_sync', 'fill_fields', 'check_recommenders');--> statement-breakpoint
CREATE TYPE "public"."browser_job_status" AS ENUM('queued', 'running', 'awaiting_verification_code', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."browser_provider" AS ENUM('browserbase', 'local');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('imessage', 'dashboard', 'system');--> statement-breakpoint
CREATE TYPE "public"."conversation_kind" AS ENUM('main', 'interview');--> statement-breakpoint
CREATE TYPE "public"."credential_provider" AS ENUM('common_app', 'gmail');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('active', 'invalid', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."decision_outcome" AS ENUM('accepted', 'rejected', 'deferred', 'waitlisted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('transcript', 'resume', 'essay_draft', 'screenshot', 'photo', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('dashboard', 'imessage', 'system');--> statement-breakpoint
CREATE TYPE "public"."drift_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."effort_level" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'processing', 'done', 'failed', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('common_app_section', 'college_questions', 'supplement_essay', 'personal_essay', 'teacher_rec', 'counselor_rec', 'other_rec', 'ferpa', 'test_scores', 'score_send', 'transcript', 'midyear_report', 'school_report', 'fafsa', 'css_profile', 'application_fee', 'fee_waiver', 'interview', 'portfolio', 'review_submit', 'custom');--> statement-breakpoint
CREATE TYPE "public"."item_source" AS ENUM('common_app', 'school_portal', 'internal_rule', 'student');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('missing', 'in_progress', 'done', 'not_applicable', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'media', 'reaction', 'system_note');--> statement-breakpoint
CREATE TYPE "public"."next_action_status" AS ENUM('open', 'done', 'snoozed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."nudge_intensity" AS ENUM('chill', 'normal', 'intense');--> statement-breakpoint
CREATE TYPE "public"."nudge_kind" AS ENUM('deadline_countdown', 'deadline_day_of', 'recommender_inactivity', 'essay_staleness', 'score_send_cutoff', 'morning_plan', 'weekly_plan', 'sync_change', 'custom');--> statement-breakpoint
CREATE TYPE "public"."recommender_assignment_status" AS ENUM('pending', 'invited', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."recommender_invite_status" AS ENUM('not_invited', 'invited', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."recommender_role" AS ENUM('teacher', 'counselor', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'admin');--> statement-breakpoint
CREATE TYPE "public"."run_outcome" AS ENUM('pending', 'running', 'completed', 'failed', 'refused', 'no_action');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('inbound_message', 'schedule', 'sync_diff', 'manual', 'proactive', 'essay_feedback', 'extraction', 'interview', 'weekly_plan', 'approval', 'reminder_draft');--> statement-breakpoint
CREATE TYPE "public"."school_type" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."self_assessment" AS ENUM('reach', 'target', 'safety');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'paused', 'deleted');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"position_title" text NOT NULL,
	"organization" text NOT NULL,
	"description" text NOT NULL,
	"grade_levels" jsonb NOT NULL,
	"timing" jsonb NOT NULL,
	"hours_per_week" numeric(5, 1) NOT NULL,
	"weeks_per_year" integer NOT NULL,
	"continue_in_college" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
	"trigger" "run_trigger" NOT NULL,
	"model" text NOT NULL,
	"tools_called" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"outcome" "run_outcome" NOT NULL,
	"error" text,
	"approval_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"application_id" uuid,
	"rule_key" text NOT NULL,
	"kind" "item_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" "item_source" NOT NULL,
	"status" "item_status" DEFAULT 'missing' NOT NULL,
	"evidence" jsonb,
	"due_date" date,
	"importance" integer DEFAULT 50 NOT NULL,
	"effort" "effort_level" DEFAULT 'medium' NOT NULL,
	"depends_on_others" boolean DEFAULT false NOT NULL,
	"blocking" boolean DEFAULT false NOT NULL,
	"student_edited" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"essay_id" uuid,
	"recommender_id" uuid,
	"last_checked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"plan" "application_plan" NOT NULL,
	"deadline" date NOT NULL,
	"deadline_source" text DEFAULT 'internal_dataset' NOT NULL,
	"status" "application_status" DEFAULT 'not_started' NOT NULL,
	"decision" "decision_outcome",
	"self_assessment" "self_assessment",
	"common_app_college_id" text,
	"submitted_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "approval_kind" NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_via" "channel" NOT NULL,
	"answered_via" "channel",
	"answered_at" timestamp with time zone,
	"answer_text" text,
	"resulting_job_id" uuid,
	"agent_run_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
	"actor" "audit_actor" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "browser_job_kind" NOT NULL,
	"status" "browser_job_status" DEFAULT 'queued' NOT NULL,
	"provider" "browser_provider" NOT NULL,
	"provider_session_id" text,
	"replay_url" text,
	"screenshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_id" uuid,
	"queue_job_id" text,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "common_app_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"browser_job_id" uuid,
	"raw" jsonb NOT NULL,
	"normalized" jsonb NOT NULL,
	"diff" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overall_confidence" numeric(4, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"provider" "credential_provider" NOT NULL,
	"status" "credential_status" DEFAULT 'active' NOT NULL,
	"username" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"session_ciphertext" "bytea",
	"session_iv" "bytea",
	"session_auth_tag" "bytea",
	"session_key_version" integer,
	"session_updated_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"source" "document_source" DEFAULT 'dashboard' NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"extraction_status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"extraction" jsonb,
	"extraction_error" text,
	"message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"essay_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"word_count" integer NOT NULL,
	"source" text DEFAULT 'dashboard_editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"essay_id" uuid NOT NULL,
	"essay_draft_id" uuid NOT NULL,
	"agent_run_id" uuid,
	"feedback" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"application_id" uuid,
	"application_item_id" uuid,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"word_limit" integer,
	"current_draft_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"direction" "direction" NOT NULL,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reaction" text,
	"in_reply_to_id" uuid,
	"provider_message_id" text,
	"delivery_status" "delivery_status" DEFAULT 'queued' NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"agent_run_id" uuid,
	"proactive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "next_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"application_item_id" uuid,
	"application_id" uuid,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"priority_score" numeric(7, 3) NOT NULL,
	"rank" integer NOT NULL,
	"due_date" date,
	"status" "next_action_status" DEFAULT 'open' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"computed_by_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "nudge_kind" NOT NULL,
	"trigger_key" text NOT NULL,
	"application_item_id" uuid,
	"application_id" uuid,
	"message_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recommender_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"recommender_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"status" "recommender_assignment_status" DEFAULT 'pending' NOT NULL,
	"invited_at" date,
	"submitted_at" date,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "recommender_role" NOT NULL,
	"email" text,
	"subject" text,
	"invite_status" "recommender_invite_status" DEFAULT 'not_invited' NOT NULL,
	"invited_at" date,
	"last_nudged_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"cycle" text NOT NULL,
	"data" jsonb NOT NULL,
	"needs_verification" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ceeb_code" text,
	"common_app_member" boolean DEFAULT true NOT NULL,
	"portal_url" text,
	"website" text,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"type" "school_type" DEFAULT 'private' NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_drift_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"browser_job_id" uuid,
	"status" "drift_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "student_narratives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"narrative" jsonb NOT NULL,
	"interview_conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"academics" jsonb NOT NULL,
	"test_scores" jsonb NOT NULL,
	"demographics" jsonb NOT NULL,
	"goals" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'student' NOT NULL,
	"status" "student_status" DEFAULT 'active' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"preferred_name" text DEFAULT '' NOT NULL,
	"phone_e164" text,
	"high_school" text DEFAULT '' NOT NULL,
	"graduation_year" integer,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"quiet_hours_start" text DEFAULT '22:00' NOT NULL,
	"quiet_hours_end" text DEFAULT '07:00' NOT NULL,
	"nudge_intensity" "nudge_intensity" DEFAULT 'normal' NOT NULL,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"sync_paused_reason" text,
	"snoozed_until" timestamp with time zone,
	"welcome_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"plan" jsonb NOT NULL,
	"agent_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_items" ADD CONSTRAINT "application_items_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_items" ADD CONSTRAINT "application_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_jobs" ADD CONSTRAINT "browser_jobs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "common_app_snapshots" ADD CONSTRAINT "common_app_snapshots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_drafts" ADD CONSTRAINT "essay_drafts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_drafts" ADD CONSTRAINT "essay_drafts_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_feedback" ADD CONSTRAINT "essay_feedback_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_feedback" ADD CONSTRAINT "essay_feedback_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_feedback" ADD CONSTRAINT "essay_feedback_essay_draft_id_essay_drafts_id_fk" FOREIGN KEY ("essay_draft_id") REFERENCES "public"."essay_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_application_item_id_application_items_id_fk" FOREIGN KEY ("application_item_id") REFERENCES "public"."application_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_assignments" ADD CONSTRAINT "recommender_assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_assignments" ADD CONSTRAINT "recommender_assignments_recommender_id_recommenders_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "public"."recommenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_assignments" ADD CONSTRAINT "recommender_assignments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommenders" ADD CONSTRAINT "recommenders_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_requirements" ADD CONSTRAINT "school_requirements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_narratives" ADD CONSTRAINT "student_narratives_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_student_position_idx" ON "activities" USING btree ("student_id","position");--> statement-breakpoint
CREATE INDEX "agent_runs_student_idx" ON "agent_runs" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "application_items_identity_idx" ON "application_items" USING btree ("student_id","application_id","rule_key");--> statement-breakpoint
CREATE INDEX "application_items_student_status_idx" ON "application_items" USING btree ("student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_student_school_idx" ON "applications" USING btree ("student_id","school_id");--> statement-breakpoint
CREATE INDEX "approvals_student_status_idx" ON "approvals" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "audit_student_idx" ON "audit_log" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "browser_jobs_student_idx" ON "browser_jobs" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "browser_jobs_status_idx" ON "browser_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "snapshots_student_idx" ON "common_app_snapshots" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_student_kind_idx" ON "conversations" USING btree ("student_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_student_provider_idx" ON "credentials" USING btree ("student_id","provider");--> statement-breakpoint
CREATE INDEX "documents_student_idx" ON "documents" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "essay_drafts_version_idx" ON "essay_drafts" USING btree ("essay_id","version");--> statement-breakpoint
CREATE INDEX "essay_feedback_essay_idx" ON "essay_feedback" USING btree ("essay_id","created_at");--> statement-breakpoint
CREATE INDEX "essays_student_idx" ON "essays" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_provider_id_idx" ON "messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "next_actions_student_status_idx" ON "next_actions" USING btree ("student_id","status","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "next_actions_item_idx" ON "next_actions" USING btree ("student_id","application_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nudges_trigger_idx" ON "nudges" USING btree ("student_id","trigger_key");--> statement-breakpoint
CREATE INDEX "nudges_sent_idx" ON "nudges" USING btree ("student_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recommender_assignments_idx" ON "recommender_assignments" USING btree ("recommender_id","application_id");--> statement-breakpoint
CREATE INDEX "recommenders_student_idx" ON "recommenders" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_requirements_school_cycle_idx" ON "school_requirements" USING btree ("school_id","cycle");--> statement-breakpoint
CREATE INDEX "schools_name_idx" ON "schools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "drift_status_idx" ON "site_drift_alerts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "narratives_student_idx" ON "student_narratives" USING btree ("student_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "students_phone_idx" ON "students" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "students_email_idx" ON "students" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_id_idx" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_plans_week_idx" ON "weekly_plans" USING btree ("student_id","week_start");