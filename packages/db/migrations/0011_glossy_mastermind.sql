CREATE TABLE "resource_template_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_key" varchar(80) NOT NULL,
	"template_type" varchar(80) NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" uuid NOT NULL,
	"applied_snapshot_json" jsonb NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"applied_by" uuid NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_template_applications" ADD CONSTRAINT "resource_template_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_template_applications" ADD CONSTRAINT "resource_template_applications_template_id_resource_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."resource_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_template_applications" ADD CONSTRAINT "resource_template_applications_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_template_applications_template_idx" ON "resource_template_applications" USING btree ("tenant_id","template_id","applied_at");--> statement-breakpoint
CREATE INDEX "resource_template_applications_target_idx" ON "resource_template_applications" USING btree ("tenant_id","module_key","target_type","target_id");