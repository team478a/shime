import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

let client: PGlite | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("database migrations", () => {
  it("applies every migration to an empty PostgreSQL database", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const names = result.rows.map((row) => row.table_name);
    expect(names).toContain("tenants");
    expect(names).toContain("events");
    expect(names).toContain("staff_sessions");
    expect(names).toContain("audit_logs");
    expect(names).toContain("resource_templates");
    expect(names).toContain("resource_template_applications");
    expect(names).toContain("concierge_card_asset_versions");
    expect(names).toContain("concierge_template_versions");
    expect(names).toContain("event_concierge_snapshots");
  }, 20_000);
  it("prevents duplicate check-in records for one event participant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    await client.exec(`
    insert into tenants(id, code, name, status, timezone) values ('00000000-0000-0000-0000-000000000001','t','Test','active','Asia/Tokyo');
    insert into events(id, tenant_id, code, name, status, starts_at, capacity, dream_registration_mode, preference_mode, allow_multiple_matches) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','e','Event','draft',now(),10,'optional','first_choice_only',false);
    insert into applications(id, tenant_id, event_id, source, status, full_name, birth_date, participant_category) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','shime_form','confirmed','Synthetic','1990-01-01','a');
    insert into participants(id, tenant_id, event_id, application_id, status, dream_state) values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','confirmed','skipped');
    insert into checkins(tenant_id,event_id,participant_id,status,method) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','checked_in','manual');
  `);
    await expect(
      client.exec(
        `insert into checkins(tenant_id,event_id,participant_id,status,method) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','checked_in','qr')`,
      ),
    ).rejects.toThrow();
  }, 20_000);
});
