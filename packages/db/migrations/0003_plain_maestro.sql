CREATE TYPE "public"."dream_state" AS ENUM('not_started', 'drafting', 'confirmed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."dream_visibility" AS ENUM('nickname_and_dream', 'dream_only', 'private');--> statement-breakpoint
CREATE TABLE "dream_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"dream_no" varchar(20) NOT NULL,
	"dream_text" varchar(500) NOT NULL,
	"visibility" "dream_visibility" NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion_card_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"version" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"card_set_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"image_key" text,
	"description" text,
	"display_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"emotion_card_id" uuid NOT NULL,
	"first_impression" varchar(500) NOT NULL,
	"related_area" varchar(500) NOT NULL,
	"underlying_wish" varchar(500) NOT NULL,
	"free_text" text,
	"redraw_count" integer DEFAULT 0 NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_dream_settings" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"card_set_id" uuid,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_timeout_ms" integer DEFAULT 10000 NOT NULL,
	"fallback_bridge_template" text NOT NULL,
	"fallback_candidates_json" jsonb NOT NULL,
	"project_consent_version" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "dream_state" "dream_state" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "dream_profiles" ADD CONSTRAINT "dream_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dream_profiles" ADD CONSTRAINT "dream_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_card_sets" ADD CONSTRAINT "emotion_card_sets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_cards" ADD CONSTRAINT "emotion_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_cards" ADD CONSTRAINT "emotion_cards_card_set_id_emotion_card_sets_id_fk" FOREIGN KEY ("card_set_id") REFERENCES "public"."emotion_card_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_selections" ADD CONSTRAINT "emotion_selections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_selections" ADD CONSTRAINT "emotion_selections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_selections" ADD CONSTRAINT "emotion_selections_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_selections" ADD CONSTRAINT "emotion_selections_emotion_card_id_emotion_cards_id_fk" FOREIGN KEY ("emotion_card_id") REFERENCES "public"."emotion_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dream_settings" ADD CONSTRAINT "event_dream_settings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dream_settings" ADD CONSTRAINT "event_dream_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dream_settings" ADD CONSTRAINT "event_dream_settings_card_set_id_emotion_card_sets_id_fk" FOREIGN KEY ("card_set_id") REFERENCES "public"."emotion_card_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dream_profiles_user_uidx" ON "dream_profiles" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dream_profiles_number_uidx" ON "dream_profiles" USING btree ("dream_no");--> statement-breakpoint
CREATE UNIQUE INDEX "emotion_card_sets_code_version_uidx" ON "emotion_card_sets" USING btree ("tenant_id","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "emotion_cards_order_uidx" ON "emotion_cards" USING btree ("tenant_id","card_set_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "emotion_selections_participant_uidx" ON "emotion_selections" USING btree ("tenant_id","event_id","participant_id");