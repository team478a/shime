CREATE TABLE "resource_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_key" varchar(80) NOT NULL,
	"template_type" varchar(80) NOT NULL,
	"template_key" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"version" integer NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"payload_json" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_templates" ADD CONSTRAINT "resource_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_templates" ADD CONSTRAINT "resource_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_templates_version_uidx" ON "resource_templates" USING btree ("tenant_id","module_key","template_type","template_key","version");--> statement-breakpoint
CREATE INDEX "resource_templates_active_idx" ON "resource_templates" USING btree ("tenant_id","module_key","template_type","active");