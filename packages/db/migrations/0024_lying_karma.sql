ALTER TABLE "event_match_chat_configs" DROP CONSTRAINT "event_match_chat_configs_enablement_check";--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD COLUMN "terms_body" text;--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD COLUMN "report_owner_label" varchar(120);--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD COLUMN "uat_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD COLUMN "uat_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD COLUMN "uat_confirmed_by" uuid;--> statement-breakpoint
-- Existing rows cannot have accepted the newly required formal terms and UAT gate.
-- Fail closed during upgrade without deleting their previous configuration.
UPDATE "event_match_chat_configs" SET "enabled" = false WHERE "enabled" = true;--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD CONSTRAINT "event_match_chat_configs_uat_confirmer_scope_fk" FOREIGN KEY ("tenant_id","uat_confirmed_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD CONSTRAINT "event_match_chat_configs_uat_check" CHECK (("event_match_chat_configs"."uat_confirmed" and "event_match_chat_configs"."uat_confirmed_at" is not null and "event_match_chat_configs"."uat_confirmed_by" is not null) or (not "event_match_chat_configs"."uat_confirmed" and "event_match_chat_configs"."uat_confirmed_at" is null and "event_match_chat_configs"."uat_confirmed_by" is null));--> statement-breakpoint
ALTER TABLE "event_match_chat_configs" ADD CONSTRAINT "event_match_chat_configs_enablement_check" CHECK (not "event_match_chat_configs"."enabled" or (coalesce(length(trim("event_match_chat_configs"."terms_version")) > 0, false) and coalesce(length(trim("event_match_chat_configs"."terms_body")) > 0, false) and coalesce("event_match_chat_configs"."retention_days" between 1 and 3650, false) and coalesce(length(trim("event_match_chat_configs"."report_owner_label")) > 0, false) and "event_match_chat_configs"."uat_confirmed" and "event_match_chat_configs"."uat_confirmed_at" is not null and "event_match_chat_configs"."uat_confirmed_by" is not null));
