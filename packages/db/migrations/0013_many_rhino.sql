ALTER TABLE "checkins" ADD COLUMN "reception_category" varchar(80);--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "reception_category_label" varchar(80);--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "reception_number" integer;--> statement-breakpoint
WITH ranked AS (
  SELECT
    c.id,
    a.participant_category AS reception_category,
    a.participant_category AS reception_category_label,
    (
      row_number() OVER (
        PARTITION BY c.tenant_id, c.event_id, a.participant_category
        ORDER BY coalesce(c.checked_in_at, c.created_at), c.id
      )
    )::integer AS reception_number
  FROM checkins c
  INNER JOIN participants p
    ON p.id = c.participant_id
    AND p.tenant_id = c.tenant_id
    AND p.event_id = c.event_id
  INNER JOIN applications a
    ON a.id = p.application_id
    AND a.tenant_id = p.tenant_id
    AND a.event_id = p.event_id
)
UPDATE checkins c
SET
  reception_category = ranked.reception_category,
  reception_category_label = ranked.reception_category_label,
  reception_number = ranked.reception_number
FROM ranked
WHERE c.id = ranked.id;--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_reception_number_uidx" ON "checkins" USING btree ("tenant_id","event_id","reception_category","reception_number");
