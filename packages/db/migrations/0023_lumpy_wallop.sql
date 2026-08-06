CREATE TABLE "match_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"sender_participant_id" uuid NOT NULL,
	"client_message_id" uuid NOT NULL,
	"encrypted_body" text NOT NULL,
	"encryption_version" varchar(20) NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_chat_messages_window_check" CHECK ("match_chat_messages"."expires_at" > "match_chat_messages"."sent_at"),
	CONSTRAINT "match_chat_messages_encryption_check" CHECK (length("match_chat_messages"."encrypted_body") > 0 and length("match_chat_messages"."encryption_version") > 0)
);
--> statement-breakpoint
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_room_scope_fk" FOREIGN KEY ("tenant_id","event_id","room_id") REFERENCES "public"."match_chat_rooms"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_sender_scope_fk" FOREIGN KEY ("tenant_id","event_id","sender_participant_id") REFERENCES "public"."participants"("tenant_id","event_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_chat_messages_idempotency_uidx" ON "match_chat_messages" USING btree ("tenant_id","event_id","room_id","sender_participant_id","client_message_id");--> statement-breakpoint
CREATE INDEX "match_chat_messages_timeline_idx" ON "match_chat_messages" USING btree ("tenant_id","event_id","room_id","sent_at");