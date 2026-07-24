CREATE TYPE "public"."journey_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "event_journey_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "journey_version_status" DEFAULT 'draft' NOT NULL,
	"steps_json" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_journey_versions" ADD CONSTRAINT "event_journey_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_journey_versions" ADD CONSTRAINT "event_journey_versions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_journey_versions" ADD CONSTRAINT "event_journey_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_journey_versions_number_uidx" ON "event_journey_versions" USING btree ("tenant_id","event_id","version");--> statement-breakpoint
CREATE INDEX "event_journey_versions_status_idx" ON "event_journey_versions" USING btree ("tenant_id","event_id","status");