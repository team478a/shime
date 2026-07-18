CREATE TABLE "job_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_key" varchar(80) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"cron_expression" varchar(120) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Tokyo' NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(40),
	"last_run_summary_json" jsonb,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_key" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"version" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_operational_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"custom_domain" varchar(255),
	"healthcheck_url" text,
	"monitoring_enabled" boolean DEFAULT true NOT NULL,
	"notification_failure_threshold" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_service_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_key" varchar(80) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_secrets" text,
	"secret_fingerprint" varchar(16),
	"last_checked_at" timestamp with time zone,
	"last_check_status" varchar(40),
	"last_check_code" varchar(120),
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_operational_settings" ADD CONSTRAINT "tenant_operational_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_operational_settings" ADD CONSTRAINT "tenant_operational_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_service_settings" ADD CONSTRAINT "tenant_service_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_service_settings" ADD CONSTRAINT "tenant_service_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_schedules_key_uidx" ON "job_schedules" USING btree ("tenant_id","job_key");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_version_uidx" ON "notification_templates" USING btree ("tenant_id","template_key","version");--> statement-breakpoint
CREATE INDEX "notification_templates_active_idx" ON "notification_templates" USING btree ("tenant_id","template_key","active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_service_settings_key_uidx" ON "tenant_service_settings" USING btree ("tenant_id","service_key");
--> statement-breakpoint
INSERT INTO "job_schedules" ("tenant_id", "job_key", "enabled", "cron_expression", "timezone")
SELECT "id", 'notification_dispatch', false, '*/5 * * * *', "timezone" FROM "tenants"
ON CONFLICT ("tenant_id", "job_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "job_schedules" ("tenant_id", "job_key", "enabled", "cron_expression", "timezone")
SELECT "id", 'health_monitor', true, '*/10 * * * *', "timezone" FROM "tenants"
ON CONFLICT ("tenant_id", "job_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "notification_templates" ("tenant_id", "template_key", "name", "body", "version", "active")
SELECT "id", template."key", template."name", template."body", 1, true
FROM "tenants"
CROSS JOIN (VALUES
  ('passport_issued', 'パスポート発行', 'Love Passportの準備ができました。'),
  ('questionnaire_reminder', '5問未回答リマインド', '席案内の5問への回答をお願いします。'),
  ('day_before', '前日案内', '明日のイベント案内をご確認ください。'),
  ('preference_open', '希望入力開始', '希望入力を開始しました。'),
  ('preference_deadline', '希望入力締切前', '希望入力の締切が近づいています。'),
  ('result_matched', '成立結果', '結果をご確認ください。お互いの気持ちが重なりました。'),
  ('result_unmatched', '不成立結果', '結果をご確認ください。今回は成立となりませんでした。')
) AS template("key", "name", "body")
ON CONFLICT ("tenant_id", "template_key", "version") DO NOTHING;
