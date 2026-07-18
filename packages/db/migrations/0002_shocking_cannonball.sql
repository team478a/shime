CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('invited', 'confirmed', 'cancelled', 'absent', 'attended');--> statement-breakpoint
CREATE TYPE "public"."line_webhook_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "line_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"webhook_event_id" varchar(160) NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"line_user_id_hash" varchar(64),
	"status" "line_webhook_status" DEFAULT 'received' NOT NULL,
	"occurred_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"error_code" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"notification_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "notification_status" NOT NULL,
	"provider_message_id" varchar(160),
	"error_code" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"channel" varchar(40) DEFAULT 'line' NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"payload_snapshot_json" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(120),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid,
	"participant_number" varchar(40),
	"status" "participant_status" DEFAULT 'confirmed' NOT NULL,
	"link_token_hash" varchar(64),
	"link_token_expires_at" timestamp with time zone,
	"link_token_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_sessions" ADD CONSTRAINT "participant_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_sessions" ADD CONSTRAINT "participant_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "line_webhook_event_uidx" ON "line_webhook_events" USING btree ("tenant_id","webhook_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_attempt_number_uidx" ON "notification_attempts" USING btree ("tenant_id","notification_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uidx" ON "notifications" USING btree ("tenant_id","event_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_queue_idx" ON "notifications" USING btree ("tenant_id","status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_sessions_token_uidx" ON "participant_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "participant_sessions_user_idx" ON "participant_sessions" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_application_uidx" ON "participants" USING btree ("tenant_id","event_id","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_user_uidx" ON "participants" USING btree ("tenant_id","event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_number_uidx" ON "participants" USING btree ("tenant_id","event_id","participant_number");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_link_token_uidx" ON "participants" USING btree ("link_token_hash");