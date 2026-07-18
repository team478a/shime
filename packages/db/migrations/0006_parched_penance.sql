CREATE TYPE "public"."match_candidate_status" AS ENUM('candidate', 'pending', 'approved', 'declined', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."preference_submission_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TABLE "conversation_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_a_id" uuid NOT NULL,
	"participant_b_id" uuid NOT NULL,
	"round_no" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_a_id" uuid NOT NULL,
	"participant_b_id" uuid NOT NULL,
	"a_rank" integer,
	"b_rank" integer,
	"status" "match_candidate_status" DEFAULT 'candidate' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"status" "preference_submission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"from_participant_id" uuid NOT NULL,
	"to_participant_id" uuid NOT NULL,
	"rank" integer,
	"private_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"confirmed_by" uuid NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"approved_count" integer NOT NULL,
	"participant_count" integer NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_pairs" ADD CONSTRAINT "conversation_pairs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_pairs" ADD CONSTRAINT "conversation_pairs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_pairs" ADD CONSTRAINT "conversation_pairs_participant_a_id_participants_id_fk" FOREIGN KEY ("participant_a_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_pairs" ADD CONSTRAINT "conversation_pairs_participant_b_id_participants_id_fk" FOREIGN KEY ("participant_b_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_participant_a_id_participants_id_fk" FOREIGN KEY ("participant_a_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_participant_b_id_participants_id_fk" FOREIGN KEY ("participant_b_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_submissions" ADD CONSTRAINT "preference_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_submissions" ADD CONSTRAINT "preference_submissions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_submissions" ADD CONSTRAINT "preference_submissions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_submission_id_preference_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."preference_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_from_participant_id_participants_id_fk" FOREIGN KEY ("from_participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_to_participant_id_participants_id_fk" FOREIGN KEY ("to_participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_confirmations" ADD CONSTRAINT "result_confirmations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_confirmations" ADD CONSTRAINT "result_confirmations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_confirmations" ADD CONSTRAINT "result_confirmations_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_confirmations" ADD CONSTRAINT "result_confirmations_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_pairs_round_uidx" ON "conversation_pairs" USING btree ("tenant_id","event_id","participant_a_id","participant_b_id","round_no");--> statement-breakpoint
CREATE UNIQUE INDEX "match_candidates_pair_uidx" ON "match_candidates" USING btree ("tenant_id","event_id","participant_a_id","participant_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_submissions_participant_uidx" ON "preference_submissions" USING btree ("tenant_id","event_id","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preferences_pair_uidx" ON "preferences" USING btree ("tenant_id","event_id","from_participant_id","to_participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preferences_rank_uidx" ON "preferences" USING btree ("tenant_id","event_id","from_participant_id","rank");--> statement-breakpoint
CREATE INDEX "result_confirmations_event_idx" ON "result_confirmations" USING btree ("tenant_id","event_id","confirmed_at");