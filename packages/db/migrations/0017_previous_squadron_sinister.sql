CREATE TABLE "event_interaction_note_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"version" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"target_source" varchar(40) NOT NULL,
	"editable_until" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_interaction_note_snapshots_scope_id_uidx" UNIQUE("tenant_id","event_id","service_type","id")
);
--> statement-breakpoint
CREATE TABLE "interaction_note_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"label" varchar(160) NOT NULL,
	"display_order" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_negative" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_note_options_scope_code_uidx" UNIQUE("tenant_id","event_id","service_type","snapshot_id","code")
);
--> statement-breakpoint
CREATE TABLE "interaction_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"actor_participant_id" uuid NOT NULL,
	"target_participant_id" uuid NOT NULL,
	"interaction_slot_id" uuid NOT NULL,
	"feeling_code" varchar(80) NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_notes_distinct_participants_check" CHECK ("interaction_notes"."actor_participant_id" <> "interaction_notes"."target_participant_id"),
	CONSTRAINT "interaction_notes_revision_positive_check" CHECK ("interaction_notes"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "interaction_slot_participants" (
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"interaction_slot_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"role_code" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_slot_participants_pk" PRIMARY KEY("tenant_id","event_id","service_type","interaction_slot_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "interaction_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_type" varchar(80) NOT NULL,
	"source" varchar(40) NOT NULL,
	"source_ref" varchar(160) NOT NULL,
	"round_no" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interaction_slots_scope_id_uidx" UNIQUE("tenant_id","event_id","service_type","id")
);
--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_event_scope_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."events"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_creator_scope_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_note_options" ADD CONSTRAINT "interaction_note_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_note_options" ADD CONSTRAINT "interaction_note_options_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_note_options" ADD CONSTRAINT "interaction_note_options_snapshot_id_event_interaction_note_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."event_interaction_note_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_note_options" ADD CONSTRAINT "interaction_note_options_snapshot_scope_fk" FOREIGN KEY ("tenant_id","event_id","service_type","snapshot_id") REFERENCES "public"."event_interaction_note_snapshots"("tenant_id","event_id","service_type","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_snapshot_id_event_interaction_note_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."event_interaction_note_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_actor_participant_id_participants_id_fk" FOREIGN KEY ("actor_participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_target_participant_id_participants_id_fk" FOREIGN KEY ("target_participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_interaction_slot_id_interaction_slots_id_fk" FOREIGN KEY ("interaction_slot_id") REFERENCES "public"."interaction_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_snapshot_scope_fk" FOREIGN KEY ("tenant_id","event_id","service_type","snapshot_id") REFERENCES "public"."event_interaction_note_snapshots"("tenant_id","event_id","service_type","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_option_scope_fk" FOREIGN KEY ("tenant_id","event_id","service_type","snapshot_id","feeling_code") REFERENCES "public"."interaction_note_options"("tenant_id","event_id","service_type","snapshot_id","code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_actor_slot_scope_fk" FOREIGN KEY ("tenant_id","event_id","service_type","interaction_slot_id","actor_participant_id") REFERENCES "public"."interaction_slot_participants"("tenant_id","event_id","service_type","interaction_slot_id","participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_notes" ADD CONSTRAINT "interaction_notes_target_slot_scope_fk" FOREIGN KEY ("tenant_id","event_id","service_type","interaction_slot_id","target_participant_id") REFERENCES "public"."interaction_slot_participants"("tenant_id","event_id","service_type","interaction_slot_id","participant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slot_participants" ADD CONSTRAINT "interaction_slot_participants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slot_participants" ADD CONSTRAINT "interaction_slot_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slot_participants" ADD CONSTRAINT "interaction_slot_participants_interaction_slot_id_interaction_slots_id_fk" FOREIGN KEY ("interaction_slot_id") REFERENCES "public"."interaction_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slot_participants" ADD CONSTRAINT "interaction_slot_participants_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slot_participants" ADD CONSTRAINT "interaction_slot_participants_slot_scope_fk" FOREIGN KEY ("tenant_id","event_id","service_type","interaction_slot_id") REFERENCES "public"."interaction_slots"("tenant_id","event_id","service_type","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slot_participants" ADD CONSTRAINT "interaction_slot_participants_participant_scope_fk" FOREIGN KEY ("tenant_id","event_id","participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slots" ADD CONSTRAINT "interaction_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slots" ADD CONSTRAINT "interaction_slots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_slots" ADD CONSTRAINT "interaction_slots_event_scope_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."events"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_interaction_note_snapshots_version_uidx" ON "event_interaction_note_snapshots" USING btree ("tenant_id","event_id","service_type","version");--> statement-breakpoint
CREATE INDEX "event_interaction_note_snapshots_active_idx" ON "event_interaction_note_snapshots" USING btree ("tenant_id","event_id","service_type","enabled");--> statement-breakpoint
CREATE INDEX "interaction_note_options_display_idx" ON "interaction_note_options" USING btree ("tenant_id","event_id","service_type","snapshot_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_notes_actor_target_slot_uidx" ON "interaction_notes" USING btree ("tenant_id","event_id","service_type","actor_participant_id","target_participant_id","interaction_slot_id");--> statement-breakpoint
CREATE INDEX "interaction_notes_actor_idx" ON "interaction_notes" USING btree ("tenant_id","event_id","service_type","actor_participant_id","updated_at");--> statement-breakpoint
CREATE INDEX "interaction_slot_participants_participant_idx" ON "interaction_slot_participants" USING btree ("tenant_id","event_id","service_type","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_slots_source_uidx" ON "interaction_slots" USING btree ("tenant_id","event_id","service_type","source","source_ref");--> statement-breakpoint
CREATE INDEX "interaction_slots_active_idx" ON "interaction_slots" USING btree ("tenant_id","event_id","service_type","status");