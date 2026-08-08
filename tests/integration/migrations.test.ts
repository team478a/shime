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
    expect(names).toContain("event_journey_versions");
    const applicationColumns = await client.query<{ column_name: string; column_default: string | null }>(
      "select column_name, column_default from information_schema.columns where table_name = 'applications'",
    );
    expect(applicationColumns.rows).toContainEqual(
      expect.objectContaining({ column_name: "additional_answers", column_default: expect.stringContaining("{}") }),
    );
  }, 20_000);

  it("stores version-safe additional application answers without changing core columns", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    await client.exec(`
      insert into tenants(id, code, name, status, timezone)
      values ('20000000-0000-0000-0000-000000000001','profile','Profile','active','Asia/Tokyo');
      insert into events(id, tenant_id, code, name, status, starts_at, capacity, dream_registration_mode, preference_mode, allow_multiple_matches)
      values ('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','event','Event','draft',now(),10,'optional','first_choice_only',false);
      insert into applications(tenant_id, event_id, source, status, full_name, birth_date, participant_category, additional_answers)
      values ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','shime_form','submitted','Synthetic','1990-01-01','group_a','{"occupation":"company","support_wanted":"hobby"}'::jsonb);
    `);
    const result = await client.query<{ additional_answers: Record<string, string> }>(
      "select additional_answers from applications where tenant_id = '20000000-0000-0000-0000-000000000001'",
    );
    expect(result.rows[0]?.additional_answers).toEqual({ occupation: "company", support_wanted: "hobby" });
  }, 20_000);
  it("stores only allowlisted per-staff permissions", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    await client.exec(`
      insert into tenants(id, code, name, status, timezone)
      values ('30000000-0000-0000-0000-000000000001','staff-scope','Staff Scope','active','Asia/Tokyo');
      insert into users(id, tenant_id, user_type, status, display_name)
      values ('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','staff','active','Synthetic Staff');
      insert into staff_roles(tenant_id, user_id, role, permissions_json)
      values (
        '30000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000002',
        'reception',
        '["checkin:write","participant:read"]'::jsonb
      );
    `);
    await expect(
      client.exec(`
        update staff_roles
        set permissions_json = '["checkin:write","unknown:permission"]'::jsonb
        where user_id = '30000000-0000-0000-0000-000000000002'
      `),
    ).rejects.toThrow();
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
  it("keeps reception numbers unique within an event category", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    await client.exec(`
      insert into tenants(id, code, name, status, timezone)
      values ('10000000-0000-0000-0000-000000000001','scope','Scope','active','Asia/Tokyo');
      insert into events(id, tenant_id, code, name, status, starts_at, capacity, dream_registration_mode, preference_mode, allow_multiple_matches)
      values ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','event','Event','draft',now(),10,'optional','first_choice_only',false);
      insert into applications(id, tenant_id, event_id, source, status, full_name, birth_date, participant_category)
      values
        ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','shime_form','confirmed','A1','1990-01-01','group_a'),
        ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','shime_form','confirmed','A2','1990-01-01','group_a'),
        ('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','shime_form','confirmed','B1','1990-01-01','group_b');
      insert into participants(id, tenant_id, event_id, application_id, status, dream_state)
      values
        ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','confirmed','skipped'),
        ('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','confirmed','skipped'),
        ('10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','confirmed','skipped');
      insert into checkins(tenant_id,event_id,participant_id,status,method,reception_category,reception_category_label,reception_number)
      values
        ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006','checked_in','manual','group_a','グループA',1),
        ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000008','checked_in','manual','group_b','グループB',1);
    `);
    await expect(
      client.exec(`
        insert into checkins(tenant_id,event_id,participant_id,status,method,reception_category,reception_category_label,reception_number)
        values ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000007','checked_in','manual','group_a','グループA',1)
      `),
    ).rejects.toThrow();
  }, 20_000);
});
