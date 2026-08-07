CREATE TYPE "public"."match_chat_report_status" AS ENUM('open', 'reviewing', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."match_chat_room_status" AS ENUM('pending_consent', 'open', 'blocked', 'closed');--> statement-breakpoint
CREATE TABLE "event_match_chat_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"window_hours" integer DEFAULT 72 NOT NULL,
	"messages_per_minute" integer DEFAULT 10 NOT NULL,
	"max_message_length" integer DEFAULT 500 NOT NULL,
	"terms_version" varchar(80),
	"retention_days" integer,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_match_chat_configs_window_check" CHECK ("event_match_chat_configs"."window_hours" between 1 and 168),
	CONSTRAINT "event_match_chat_configs_rate_check" CHECK ("event_match_chat_configs"."messages_per_minute" between 1 and 60),
	CONSTRAINT "event_match_chat_configs_length_check" CHECK ("event_match_chat_configs"."max_message_length" between 1 and 2000),
	CONSTRAINT "event_match_chat_configs_enablement_check" CHECK (not "event_match_chat_configs"."enabled" or (coalesce(length(trim("event_match_chat_configs"."terms_version")) > 0, false) and coalesce("event_match_chat_configs"."retention_days" between 1 and 3650, false)))
);
--> statement-breakpoint
CREATE TABLE "match_chat_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"blocker_participant_id" uuid NOT NULL,
	"blocked_participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_chat_blocks_distinct_participants_check" CHECK ("match_chat_blocks"."blocker_participant_id" <> "match_chat_blocks"."blocked_participant_id")
);
--> statement-breakpoint
CREATE TABLE "match_chat_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"terms_version" varchar(80) NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_chat_consents_terms_check" CHECK (length(trim("match_chat_consents"."terms_version")) > 0)
);
--> statement-breakpoint
CREATE TABLE "match_chat_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"reporter_participant_id" uuid NOT NULL,
	"reported_participant_id" uuid NOT NULL,
	"category" varchar(40) NOT NULL,
	"detail" varchar(1000),
	"status" "match_chat_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_chat_reports_distinct_participants_check" CHECK ("match_chat_reports"."reporter_participant_id" <> "match_chat_reports"."reported_participant_id"),
	CONSTRAINT "match_chat_reports_category_check" CHECK ("match_chat_reports"."category" in ('harassment','spam','inappropriate','safety_concern','other'))
);
--> statement-breakpoint
CREATE TABLE "match_chat_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"match_candidate_id" uuid NOT NULL,
	"participant_a_id" uuid NOT NULL,
	"participant_b_id" uuid NOT NULL,
	"status" "match_chat_room_status" DEFAULT 'pending_consent' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone NOT NULL,
	"blocked_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_chat_rooms_scope_id_uidx" UNIQUE("tenant_id","event_id","id"),
	CONSTRAINT "match_chat_rooms_distinct_participants_check" CHECK ("match_chat_rooms"."participant_a_id" <> "match_chat_rooms"."participant_b_id"),
	CONSTRAINT "match_chat_rooms_window_check" CHECK ("match_chat_rooms"."closes_at" > coalesce("match_chat_rooms"."opens_at", "match_chat_rooms"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_scope_pair_id_uidx" UNIQUE("tenant_id","event_id","id","participant_a_id","participant_b_id");--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD CONSTRAINT "event_match_chat_configs_event_scope_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."events"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD CONSTRAINT "event_match_chat_configs_updater_scope_fk" FOREIGN KEY ("tenant_id","updated_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_blocks" ADD CONSTRAINT "match_chat_blocks_room_scope_fk" FOREIGN KEY ("tenant_id","event_id","room_id") REFERENCES "public"."match_chat_rooms"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_blocks" ADD CONSTRAINT "match_chat_blocks_blocker_scope_fk" FOREIGN KEY ("tenant_id","event_id","blocker_participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_blocks" ADD CONSTRAINT "match_chat_blocks_blocked_scope_fk" FOREIGN KEY ("tenant_id","event_id","blocked_participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_consents" ADD CONSTRAINT "match_chat_consents_room_scope_fk" FOREIGN KEY ("tenant_id","event_id","room_id") REFERENCES "public"."match_chat_rooms"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_consents" ADD CONSTRAINT "match_chat_consents_participant_scope_fk" FOREIGN KEY ("tenant_id","event_id","participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_reports" ADD CONSTRAINT "match_chat_reports_room_scope_fk" FOREIGN KEY ("tenant_id","event_id","room_id") REFERENCES "public"."match_chat_rooms"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_reports" ADD CONSTRAINT "match_chat_reports_reporter_scope_fk" FOREIGN KEY ("tenant_id","event_id","reporter_participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_reports" ADD CONSTRAINT "match_chat_reports_reported_scope_fk" FOREIGN KEY ("tenant_id","event_id","reported_participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_reports" ADD CONSTRAINT "match_chat_reports_resolver_scope_fk" FOREIGN KEY ("tenant_id","resolved_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_rooms" ADD CONSTRAINT "match_chat_rooms_event_scope_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."events"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_rooms" ADD CONSTRAINT "match_chat_rooms_candidate_pair_scope_fk" FOREIGN KEY ("tenant_id","event_id","match_candidate_id","participant_a_id","participant_b_id") REFERENCES "public"."match_candidates"("tenant_id","event_id","id","participant_a_id","participant_b_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_match_chat_configs_scope_uidx" ON "event_match_chat_configs" USING btree ("tenant_id","event_id","service_type");--> statement-breakpoint
CREATE UNIQUE INDEX "match_chat_blocks_room_blocker_uidx" ON "match_chat_blocks" USING btree ("room_id","blocker_participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_chat_consents_room_participant_uidx" ON "match_chat_consents" USING btree ("room_id","participant_id");--> statement-breakpoint
CREATE INDEX "match_chat_reports_queue_idx" ON "match_chat_reports" USING btree ("tenant_id","event_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_chat_rooms_candidate_uidx" ON "match_chat_rooms" USING btree ("tenant_id","event_id","service_type","match_candidate_id");
