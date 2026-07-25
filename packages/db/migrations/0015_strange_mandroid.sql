CREATE TYPE "public"."concierge_session_status" AS ENUM('in_progress', 'submitted');--> statement-breakpoint
CREATE TABLE "concierge_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"session_id" uuid,
	"viewer_user_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_answer_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"answer_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"axis_code" varchar(40) NOT NULL,
	"option_code" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_rule_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"submitted_revision" integer NOT NULL,
	"algorithm_version" varchar(80) NOT NULL,
	"primary_emotion_code" varchar(40) NOT NULL,
	"result_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"status" "concierge_session_status" DEFAULT 'in_progress' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"selected_card_asset_version_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concierge_sessions_tenant_event_id_uidx" UNIQUE("tenant_id","event_id","id")
);
--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD COLUMN "access_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD COLUMN "access_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD COLUMN "allow_resubmission" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "concierge_card_asset_versions" ADD CONSTRAINT "concierge_card_asset_versions_tenant_id_uidx" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD CONSTRAINT "event_concierge_snapshots_tenant_event_id_uidx" UNIQUE("tenant_id","event_id","id");--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tenant_event_id_uidx" UNIQUE("tenant_id","event_id","id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_scope_uidx" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_session_id_concierge_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."concierge_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_participant_scope_fk" FOREIGN KEY ("tenant_id","event_id","participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_session_scope_fk" FOREIGN KEY ("tenant_id","event_id","session_id") REFERENCES "public"."concierge_sessions"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_access_logs" ADD CONSTRAINT "concierge_access_logs_viewer_tenant_fk" FOREIGN KEY ("tenant_id","viewer_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answer_revisions" ADD CONSTRAINT "concierge_answer_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answer_revisions" ADD CONSTRAINT "concierge_answer_revisions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answer_revisions" ADD CONSTRAINT "concierge_answer_revisions_session_id_concierge_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."concierge_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answer_revisions" ADD CONSTRAINT "concierge_answer_revisions_session_scope_fk" FOREIGN KEY ("tenant_id","event_id","session_id") REFERENCES "public"."concierge_sessions"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answers" ADD CONSTRAINT "concierge_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answers" ADD CONSTRAINT "concierge_answers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answers" ADD CONSTRAINT "concierge_answers_session_id_concierge_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."concierge_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_answers" ADD CONSTRAINT "concierge_answers_session_scope_fk" FOREIGN KEY ("tenant_id","event_id","session_id") REFERENCES "public"."concierge_sessions"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_rule_results" ADD CONSTRAINT "concierge_rule_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_rule_results" ADD CONSTRAINT "concierge_rule_results_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_rule_results" ADD CONSTRAINT "concierge_rule_results_session_id_concierge_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."concierge_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_rule_results" ADD CONSTRAINT "concierge_rule_results_session_scope_fk" FOREIGN KEY ("tenant_id","event_id","session_id") REFERENCES "public"."concierge_sessions"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_snapshot_id_event_concierge_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."event_concierge_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_selected_card_asset_version_id_concierge_card_asset_versions_id_fk" FOREIGN KEY ("selected_card_asset_version_id") REFERENCES "public"."concierge_card_asset_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_participant_scope_fk" FOREIGN KEY ("tenant_id","event_id","participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_snapshot_scope_fk" FOREIGN KEY ("tenant_id","event_id","snapshot_id") REFERENCES "public"."event_concierge_snapshots"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_sessions" ADD CONSTRAINT "concierge_sessions_selected_card_tenant_fk" FOREIGN KEY ("tenant_id","selected_card_asset_version_id") REFERENCES "public"."concierge_card_asset_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "concierge_access_logs_participant_idx" ON "concierge_access_logs" USING btree ("tenant_id","event_id","participant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_answer_revisions_number_uidx" ON "concierge_answer_revisions" USING btree ("tenant_id","event_id","session_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_answers_axis_uidx" ON "concierge_answers" USING btree ("tenant_id","event_id","session_id","axis_code");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_rule_results_revision_uidx" ON "concierge_rule_results" USING btree ("tenant_id","event_id","session_id","submitted_revision");--> statement-breakpoint
CREATE INDEX "concierge_rule_results_session_idx" ON "concierge_rule_results" USING btree ("tenant_id","event_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_sessions_participant_uidx" ON "concierge_sessions" USING btree ("tenant_id","event_id","participant_id");--> statement-breakpoint
CREATE INDEX "concierge_sessions_status_idx" ON "concierge_sessions" USING btree ("tenant_id","event_id","status");