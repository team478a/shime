import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

let client: PGlite | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

const id = (scope: number, item: number) => `${scope}0000000-0000-0000-0000-${String(item).padStart(12, "0")}`;

function seedScope(scope: number) {
  const tenantId = id(scope, 1);
  const eventId = id(scope, 2);
  const staffUserId = id(scope, 3);
  const applicationIds = [id(scope, 10), id(scope, 11)];
  const participantIds = [id(scope, 20), id(scope, 21)];
  const snapshotId = id(scope, 30);
  const optionId = id(scope, 31);
  const slotId = id(scope, 40);
  const sql = [
    `insert into tenants(id, code, name, status, timezone) values ('${tenantId}','interaction-${scope}','Tenant ${scope}','active','Asia/Tokyo')`,
    `insert into events(id, tenant_id, code, name, status, starts_at, capacity, dream_registration_mode, preference_mode, allow_multiple_matches) values ('${eventId}','${tenantId}','event-${scope}','Event ${scope}','draft',now(),20,'optional','first_choice_only',false)`,
    `insert into users(id, tenant_id, user_type, status, display_name) values ('${staffUserId}','${tenantId}','staff','active','Staff ${scope}')`,
    ...applicationIds.map(
      (applicationId, index) =>
        `insert into applications(id, tenant_id, event_id, source, status, full_name, birth_date, participant_category) values ('${applicationId}','${tenantId}','${eventId}','shime_form','confirmed','P${scope}-${index}','1990-01-01','group_a')`,
    ),
    ...participantIds.map(
      (participantId, index) =>
        `insert into participants(id, tenant_id, event_id, application_id, participant_number, status, dream_state) values ('${participantId}','${tenantId}','${eventId}','${applicationIds[index]}','A0${index + 1}','confirmed','skipped')`,
    ),
    `insert into event_interaction_note_snapshots(id, tenant_id, event_id, service_type, version, enabled, status, target_source, editable_until, published_at, created_by) values ('${snapshotId}','${tenantId}','${eventId}','marriage',1,true,'published','interaction_slot',now() + interval '1 day',now(),'${staffUserId}')`,
    `insert into interaction_note_options(id, tenant_id, event_id, service_type, snapshot_id, code, label, display_order) values ('${optionId}','${tenantId}','${eventId}','marriage','${snapshotId}','comfortable','Comfortable',1)`,
    `insert into interaction_slots(id, tenant_id, event_id, service_type, source, source_ref, round_no) values ('${slotId}','${tenantId}','${eventId}','marriage','seating','pair-${scope}',1)`,
    ...participantIds.map(
      (participantId) =>
        `insert into interaction_slot_participants(tenant_id, event_id, service_type, interaction_slot_id, participant_id) values ('${tenantId}','${eventId}','marriage','${slotId}','${participantId}')`,
    ),
  ].join(";\n");
  return { tenantId, eventId, staffUserId, participantIds, snapshotId, slotId, sql };
}

describe("interaction memo migration and scope constraints", () => {
  it("enforces draft, published and stopped lifecycle while allowing only one published version", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const first = seedScope(1);
    const second = seedScope(2);
    await client.exec(`${first.sql};\n${second.sql};`);
    const draftId = id(1, 32);

    await expect(
      client.exec(
        `insert into event_interaction_note_snapshots(id,tenant_id,event_id,service_type,version,enabled,status,target_source,created_by) values ('${draftId}','${first.tenantId}','${first.eventId}','marriage',2,false,'draft','self_reported','${first.staffUserId}')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `update event_interaction_note_snapshots set enabled=true,status='published',published_at=now() where id='${draftId}'`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `update event_interaction_note_snapshots set enabled=false,status='stopped',published_at=now(),stopped_at=now() where id='${draftId}'`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `insert into event_interaction_note_snapshots(tenant_id,event_id,service_type,version,enabled,status,target_source,created_by) values ('${first.tenantId}','${second.eventId}','marriage',3,false,'draft','self_reported','${first.staffUserId}')`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("stores only the fixed allowlist and limits the private memo to 120 characters and 3 lines", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const scope = seedScope(4);
    await client.exec(`${scope.sql};`);

    await expect(
      client.exec(
        `update event_interaction_note_snapshots set public_profile_field_keys_json = '["nickname","hobbies","holiday_style","support_wanted","support_offered"]'::jsonb where id = '${scope.snapshotId}'`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `update event_interaction_note_snapshots set public_profile_field_keys_json = '{"nickname":true}'::jsonb where id = '${scope.snapshotId}'`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `update event_interaction_note_snapshots set public_profile_field_keys_json = '["full_name"]'::jsonb where id = '${scope.snapshotId}'`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code,private_note_text) values ('${scope.tenantId}','${scope.eventId}','marriage','${scope.snapshotId}','${scope.participantIds[0]}','${scope.participantIds[1]}','${scope.slotId}','comfortable','${"a".repeat(120)}')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `update interaction_notes set private_note_text = '${"a".repeat(121)}' where actor_participant_id = '${scope.participantIds[0]}'`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `update interaction_notes set private_note_text = E'1\\n2\\n3', wants_to_talk_more = true where actor_participant_id = '${scope.participantIds[0]}'`,
      ),
    ).resolves.toBeDefined();
    const saved = await client.query<{ private_note_text: string; wants_to_talk_more: boolean }>(
      `select private_note_text, wants_to_talk_more from interaction_notes where actor_participant_id = '${scope.participantIds[0]}'`,
    );
    expect(saved.rows).toEqual([{ private_note_text: "1\n2\n3", wants_to_talk_more: true }]);
    await expect(
      client.exec(
        `update interaction_notes set private_note_text = E'1\\n2\\n3\\n4' where actor_participant_id = '${scope.participantIds[0]}'`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("accepts a valid note and rejects cross-scope or non-conversation writes", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const first = seedScope(7);
    const second = seedScope(8);
    await client.exec(`${first.sql};\n${second.sql};`);

    await expect(
      client.exec(
        `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code,favorite) values ('${first.tenantId}','${first.eventId}','marriage','${first.snapshotId}','${first.participantIds[0]}','${first.participantIds[1]}','${first.slotId}','comfortable',true)`,
      ),
    ).resolves.toBeDefined();

    const nextSnapshotId = id(7, 32);
    const nextOptionId = id(7, 33);
    await expect(
      client.exec(
        [
          `update event_interaction_note_snapshots set enabled=false,status='stopped',stopped_at=now() where id='${first.snapshotId}'`,
          `insert into event_interaction_note_snapshots(id, tenant_id, event_id, service_type, version, enabled, status, target_source, editable_until, published_at, created_by) values ('${nextSnapshotId}','${first.tenantId}','${first.eventId}','marriage',2,true,'published','interaction_slot',now() + interval '1 day',now(),'${first.staffUserId}')`,
          `insert into interaction_note_options(id, tenant_id, event_id, service_type, snapshot_id, code, label, display_order) values ('${nextOptionId}','${first.tenantId}','${first.eventId}','marriage','${nextSnapshotId}','comfortable','Comfortable v2',1)`,
          `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code,favorite) values ('${first.tenantId}','${first.eventId}','marriage','${nextSnapshotId}','${first.participantIds[0]}','${first.participantIds[1]}','${first.slotId}','comfortable',false)`,
        ].join(";\n"),
      ),
    ).resolves.toBeDefined();

    await expect(
      client.exec(
        `insert into interaction_slots(tenant_id,event_id,service_type,source,source_ref) values ('${first.tenantId}','${second.eventId}','marriage','standing','cross-event')`,
      ),
    ).rejects.toThrow();

    await expect(
      client.exec(
        `insert into interaction_slot_participants(tenant_id,event_id,service_type,interaction_slot_id,participant_id) values ('${first.tenantId}','${first.eventId}','marriage','${first.slotId}','${second.participantIds[0]}')`,
      ),
    ).rejects.toThrow();

    await expect(
      client.exec(
        `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code) values ('${first.tenantId}','${first.eventId}','marriage','${first.snapshotId}','${first.participantIds[0]}','${second.participantIds[0]}','${first.slotId}','comfortable')`,
      ),
    ).rejects.toThrow();

    await expect(
      client.exec(
        `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code) values ('${second.tenantId}','${second.eventId}','marriage','${second.snapshotId}','${second.participantIds[0]}','${second.participantIds[0]}','${second.slotId}','comfortable')`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("requires the feeling code to belong to the same immutable snapshot and service", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const scope = seedScope(9);
    await client.exec(`${scope.sql};`);

    await expect(
      client.exec(
        `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code) values ('${scope.tenantId}','${scope.eventId}','marriage','${scope.snapshotId}','${scope.participantIds[0]}','${scope.participantIds[1]}','${scope.slotId}','not-in-snapshot')`,
      ),
    ).rejects.toThrow();

    await expect(
      client.exec(
        `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code) values ('${scope.tenantId}','${scope.eventId}','business','${scope.snapshotId}','${scope.participantIds[0]}','${scope.participantIds[1]}','${scope.slotId}','comfortable')`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("keeps self-reported standing slots idempotent and rejects cross-event membership", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const first = seedScope(5);
    const second = seedScope(6);
    await client.exec(`${first.sql};\n${second.sql};`);
    await client.exec(
      first.participantIds
        .map(
          (participantId) =>
            `insert into checkins(tenant_id,event_id,participant_id,status,method,checked_in_at) values ('${first.tenantId}','${first.eventId}','${participantId}','checked_in','manual',now())`,
        )
        .join(";\n"),
    );
    const selfReportedSlotId = id(5, 41);
    const pairRef = `self:${[...first.participantIds].sort().join(":")}`;
    await expect(
      client.exec(
        [
          `insert into interaction_slots(id,tenant_id,event_id,service_type,source,source_ref) values ('${selfReportedSlotId}','${first.tenantId}','${first.eventId}','marriage','self_reported','${pairRef}')`,
          ...first.participantIds.map(
            (participantId) =>
              `insert into interaction_slot_participants(tenant_id,event_id,service_type,interaction_slot_id,participant_id) values ('${first.tenantId}','${first.eventId}','marriage','${selfReportedSlotId}','${participantId}')`,
          ),
        ].join(";\n"),
      ),
    ).resolves.toBeDefined();

    await expect(
      client.exec(
        `insert into interaction_slots(tenant_id,event_id,service_type,source,source_ref) values ('${first.tenantId}','${first.eventId}','marriage','self_reported','${pairRef}')`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `insert into interaction_slot_participants(tenant_id,event_id,service_type,interaction_slot_id,participant_id) values ('${first.tenantId}','${first.eventId}','marriage','${selfReportedSlotId}','${second.participantIds[0]}')`,
      ),
    ).rejects.toThrow();
  }, 30_000);
});
