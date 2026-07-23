CREATE TYPE "public"."concierge_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "concierge_card_asset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "concierge_version_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"alt_text" varchar(500) NOT NULL,
	"storage_object_key" text NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"pixel_count" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_card_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_key" varchar(80) DEFAULT 'concierge' NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"status" "concierge_version_status" DEFAULT 'draft' NOT NULL,
	"payload_json" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concierge_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_key" varchar(80) DEFAULT 'concierge' NOT NULL,
	"template_key" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_concierge_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"template_version_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"applied_by" uuid NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "concierge_card_asset_versions" ADD CONSTRAINT "concierge_card_asset_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_card_asset_versions" ADD CONSTRAINT "concierge_card_asset_versions_asset_id_concierge_card_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."concierge_card_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_card_asset_versions" ADD CONSTRAINT "concierge_card_asset_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_card_assets" ADD CONSTRAINT "concierge_card_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_card_assets" ADD CONSTRAINT "concierge_card_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_template_versions" ADD CONSTRAINT "concierge_template_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_template_versions" ADD CONSTRAINT "concierge_template_versions_template_id_concierge_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."concierge_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_template_versions" ADD CONSTRAINT "concierge_template_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_templates" ADD CONSTRAINT "concierge_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concierge_templates" ADD CONSTRAINT "concierge_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD CONSTRAINT "event_concierge_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD CONSTRAINT "event_concierge_snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD CONSTRAINT "event_concierge_snapshots_template_version_id_concierge_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."concierge_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_concierge_snapshots" ADD CONSTRAINT "event_concierge_snapshots_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_card_asset_versions_number_uidx" ON "concierge_card_asset_versions" USING btree ("tenant_id","asset_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_card_asset_versions_hash_uidx" ON "concierge_card_asset_versions" USING btree ("tenant_id","content_hash");--> statement-breakpoint
CREATE INDEX "concierge_card_asset_versions_status_idx" ON "concierge_card_asset_versions" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_card_assets_code_uidx" ON "concierge_card_assets" USING btree ("tenant_id","module_key","code");--> statement-breakpoint
CREATE INDEX "concierge_card_assets_tenant_idx" ON "concierge_card_assets" USING btree ("tenant_id","module_key","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_template_versions_number_uidx" ON "concierge_template_versions" USING btree ("tenant_id","template_id","version");--> statement-breakpoint
CREATE INDEX "concierge_template_versions_status_idx" ON "concierge_template_versions" USING btree ("tenant_id","template_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "concierge_templates_key_uidx" ON "concierge_templates" USING btree ("tenant_id","module_key","template_key");--> statement-breakpoint
CREATE INDEX "concierge_templates_tenant_idx" ON "concierge_templates" USING btree ("tenant_id","module_key","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_concierge_snapshots_event_uidx" ON "event_concierge_snapshots" USING btree ("tenant_id","event_id");--> statement-breakpoint
CREATE INDEX "event_concierge_snapshots_version_idx" ON "event_concierge_snapshots" USING btree ("tenant_id","template_version_id");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE concierge_card_assets, concierge_card_asset_versions, concierge_templates, concierge_template_versions, event_concierge_snapshots FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE concierge_card_assets, concierge_card_asset_versions, concierge_templates, concierge_template_versions, event_concierge_snapshots FROM authenticated;
  END IF;
END $$;
