ALTER TABLE "event_interaction_note_snapshots" ADD COLUMN "status" varchar(20) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD COLUMN "stopped_at" timestamp with time zone;--> statement-breakpoint
WITH ranked_enabled AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "tenant_id", "event_id", "service_type"
      ORDER BY "version" DESC, "created_at" DESC
    ) AS "rank"
  FROM "event_interaction_note_snapshots"
  WHERE "enabled" = true
)
UPDATE "event_interaction_note_snapshots" AS snapshot
SET
  "status" = CASE WHEN ranked_enabled."rank" = 1 THEN 'published' ELSE 'stopped' END,
  "enabled" = ranked_enabled."rank" = 1,
  "published_at" = snapshot."created_at",
  "stopped_at" = CASE WHEN ranked_enabled."rank" = 1 THEN NULL ELSE snapshot."updated_at" END
FROM ranked_enabled
WHERE snapshot."id" = ranked_enabled."id";--> statement-breakpoint
UPDATE "event_interaction_note_snapshots" AS snapshot
SET
  "status" = 'stopped',
  "published_at" = snapshot."created_at",
  "stopped_at" = snapshot."updated_at"
WHERE snapshot."enabled" = false
  AND snapshot."status" = 'draft'
  AND EXISTS (
    SELECT 1
    FROM "interaction_notes" AS note
    WHERE note."tenant_id" = snapshot."tenant_id"
      AND note."event_id" = snapshot."event_id"
      AND note."service_type" = snapshot."service_type"
      AND note."snapshot_id" = snapshot."id"
  );--> statement-breakpoint
CREATE UNIQUE INDEX "event_interaction_note_snapshots_published_uidx" ON "event_interaction_note_snapshots" USING btree ("tenant_id","event_id","service_type") WHERE "event_interaction_note_snapshots"."status" = 'published';--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_status_check" CHECK ("event_interaction_note_snapshots"."status" in ('draft', 'published', 'stopped'));--> statement-breakpoint
ALTER TABLE "event_interaction_note_snapshots" ADD CONSTRAINT "event_interaction_note_snapshots_lifecycle_check" CHECK (("event_interaction_note_snapshots"."status" = 'draft' and not "event_interaction_note_snapshots"."enabled" and "event_interaction_note_snapshots"."published_at" is null and "event_interaction_note_snapshots"."stopped_at" is null)
        or ("event_interaction_note_snapshots"."status" = 'published' and "event_interaction_note_snapshots"."enabled" and "event_interaction_note_snapshots"."published_at" is not null and "event_interaction_note_snapshots"."stopped_at" is null)
        or ("event_interaction_note_snapshots"."status" = 'stopped' and not "event_interaction_note_snapshots"."enabled" and "event_interaction_note_snapshots"."published_at" is not null and "event_interaction_note_snapshots"."stopped_at" is not null));
