CREATE TYPE "public"."application_source" AS ENUM('shime_form', 'csv');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('draft', 'submitted', 'confirmed', 'cancelled', 'rejected', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."duplicate_resolution" AS ENUM('pending', 'same_person', 'different_person', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."application_import_row_level" AS ENUM('valid', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."application_import_status" AS ENUM('validating', 'validated', 'committing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "application_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"consent_type" varchar(80) NOT NULL,
	"document_version" varchar(80) NOT NULL,
	"accepted" boolean NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"level" "application_import_row_level" NOT NULL,
	"external_id" varchar(160),
	"normalized_data_json" jsonb NOT NULL,
	"issues_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"committed_application_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"original_file_key" text NOT NULL,
	"original_file_hash" varchar(64) NOT NULL,
	"status" "application_import_status" NOT NULL,
	"mode" varchar(20) NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"success_rows" integer DEFAULT 0 NOT NULL,
	"warning_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"imported_by" uuid NOT NULL,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"source" "application_source" NOT NULL,
	"external_id" varchar(160),
	"status" "application_status" NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"full_name_kana" varchar(160),
	"phone" varchar(40),
	"phone_normalized" varchar(32),
	"email" varchar(320),
	"email_normalized" varchar(320),
	"birth_date" varchar(10) NOT NULL,
	"nickname" varchar(120),
	"residence_area" varchar(240),
	"participant_category" varchar(80) NOT NULL,
	"notes" text,
	"submitted_at" timestamp with time zone,
	"idempotency_key_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"candidate_application_id" uuid NOT NULL,
	"reasons_json" jsonb NOT NULL,
	"resolution" "duplicate_resolution" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_consents" ADD CONSTRAINT "application_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_consents" ADD CONSTRAINT "application_consents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_consents" ADD CONSTRAINT "application_consents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_import_rows" ADD CONSTRAINT "application_import_rows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_import_rows" ADD CONSTRAINT "application_import_rows_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_import_rows" ADD CONSTRAINT "application_import_rows_import_id_application_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."application_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_import_rows" ADD CONSTRAINT "application_import_rows_committed_application_id_applications_id_fk" FOREIGN KEY ("committed_application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_imports" ADD CONSTRAINT "application_imports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_imports" ADD CONSTRAINT "application_imports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_imports" ADD CONSTRAINT "application_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_candidate_application_id_applications_id_fk" FOREIGN KEY ("candidate_application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_consents_type_uidx" ON "application_consents" USING btree ("tenant_id","application_id","consent_type","document_version");--> statement-breakpoint
CREATE UNIQUE INDEX "application_import_rows_number_uidx" ON "application_import_rows" USING btree ("tenant_id","import_id","row_number");--> statement-breakpoint
CREATE UNIQUE INDEX "application_imports_file_uidx" ON "application_imports" USING btree ("tenant_id","event_id","original_file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_event_external_uidx" ON "applications" USING btree ("tenant_id","event_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_idempotency_uidx" ON "applications" USING btree ("tenant_id","event_id","idempotency_key_hash");--> statement-breakpoint
CREATE INDEX "applications_phone_idx" ON "applications" USING btree ("tenant_id","event_id","phone_normalized");--> statement-breakpoint
CREATE INDEX "applications_email_idx" ON "applications" USING btree ("tenant_id","event_id","email_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_candidates_pair_uidx" ON "duplicate_candidates" USING btree ("tenant_id","event_id","application_id","candidate_application_id");