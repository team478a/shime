import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createDrizzleOperationsAnalyticsRepository } from "@shime/operations-analytics";
import { getDatabase } from "@shime/db";
import * as schema from "@shime/db";

let client: PGlite | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

const id = (scope: number, item: number) => `${scope}0000000-0000-4000-8000-${String(item).padStart(12, "0")}`;

function seed(scope: number, options: { tenantId?: string; includeTenant?: boolean } = {}) {
  const tenantId = options.tenantId ?? id(scope, 1);
  const eventId = id(scope, 2);
  const userId = id(scope, 3);
  const snapshotId = id(scope, 4);
  const slotId = id(scope, 5);
  const applicationIds = Array.from({ length: 6 }, (_, index) => id(scope, 100 + index));
  const participantIds = Array.from({ length: 6 }, (_, index) => id(scope, 200 + index));
  const statements = [
    ...(options.includeTenant === false
      ? []
      : [
          `insert into tenants(id,code,name,status,timezone) values ('${tenantId}','analytics-${scope}','Analytics ${scope}','active','Asia/Tokyo')`,
        ]),
    `insert into users(id,tenant_id,user_type,status,display_name) values ('${userId}','${tenantId}','staff','active','Staff')`,
    `insert into events(id,tenant_id,code,name,status,starts_at,capacity,dream_registration_mode,preference_mode,allow_multiple_matches) values ('${eventId}','${tenantId}','event-${scope}','Event ${scope}','in_progress',now(),20,'optional','first_choice_only',false)`,
    ...applicationIds.map(
      (applicationId, index) =>
        `insert into applications(id,tenant_id,event_id,source,status,full_name,birth_date,participant_category) values ('${applicationId}','${tenantId}','${eventId}','shime_form','confirmed','Person ${index}','1990-01-01','${index < 3 ? "group_a" : "group_b"}')`,
    ),
    ...participantIds.map(
      (participantId, index) =>
        `insert into participants(id,tenant_id,event_id,application_id,participant_number,status,dream_state) values ('${participantId}','${tenantId}','${eventId}','${applicationIds[index]}','${index < 3 ? "A" : "B"}0${(index % 3) + 1}','confirmed','skipped')`,
    ),
    `insert into event_interaction_note_snapshots(id,tenant_id,event_id,service_type,version,enabled,status,target_source,published_at,created_by) values ('${snapshotId}','${tenantId}','${eventId}','marriage',1,true,'published','interaction_slot',now(),'${userId}')`,
    `insert into interaction_note_options(tenant_id,event_id,service_type,snapshot_id,code,label,display_order) values ('${tenantId}','${eventId}','marriage','${snapshotId}','positive','Positive',1)`,
    `insert into interaction_slots(id,tenant_id,event_id,service_type,source,source_ref,status) values ('${slotId}','${tenantId}','${eventId}','marriage','operator_import','slot-${scope}','active')`,
    ...participantIds.map(
      (participantId) =>
        `insert into interaction_slot_participants(tenant_id,event_id,service_type,interaction_slot_id,participant_id) values ('${tenantId}','${eventId}','marriage','${slotId}','${participantId}')`,
    ),
    ...participantIds
      .slice(0, 5)
      .map(
        (participantId, index) =>
          `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code,favorite,wants_to_talk_more,private_note_text) values ('${tenantId}','${eventId}','marriage','${snapshotId}','${participantId}','${participantIds[5]}','${slotId}','positive',${index < 3},${index < 4},'private-${scope}-${index}')`,
      ),
    ...participantIds
      .slice(0, 3)
      .map(
        (participantAId, index) =>
          `insert into match_candidates(id,tenant_id,event_id,participant_a_id,participant_b_id,status) values ('${id(scope, 300 + index)}','${tenantId}','${eventId}','${participantAId}','${participantIds[index + 3]}','approved')`,
      ),
    ...participantIds
      .slice(0, 3)
      .map(
        (participantAId, index) =>
          `insert into match_chat_rooms(id,tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,status,opens_at,closes_at) values ('${id(scope, 400 + index)}','${tenantId}','${eventId}','marriage','${id(scope, 300 + index)}','${participantAId}','${participantIds[index + 3]}','open',now(),now()+interval '72 hours')`,
      ),
    `insert into match_chat_messages(tenant_id,event_id,room_id,sender_participant_id,client_message_id,encrypted_body,encryption_version,sent_at,expires_at) values ('${tenantId}','${eventId}','${id(scope, 400)}','${participantIds[0]}','${id(scope, 500)}','encrypted-private-${scope}','v1',now(),now()+interval '30 days')`,
    `insert into match_chat_reports(tenant_id,event_id,room_id,reporter_participant_id,reported_participant_id,category,detail) values ('${tenantId}','${eventId}','${id(scope, 400)}','${participantIds[0]}','${participantIds[3]}','other','private-report-${scope}')`,
  ];
  return { tenantId, eventId, participantIds, statements };
}

describe("operations analytics repository scope", () => {
  it("aggregates only the requested tenant/event/service without returning private content or identifiers", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const requested = seed(1);
    const otherTenant = seed(2);
    const otherEvent = seed(3, { tenantId: requested.tenantId, includeTenant: false });
    const serviceSnapshotId = id(4, 4);
    const serviceSlotId = id(4, 5);
    const serviceRoomId = id(4, 400);
    const serviceNoise = [
      `insert into event_interaction_note_snapshots(id,tenant_id,event_id,service_type,version,enabled,status,target_source,published_at,created_by) values ('${serviceSnapshotId}','${requested.tenantId}','${requested.eventId}','business',1,true,'published','interaction_slot',now(),'${id(1, 3)}')`,
      `insert into interaction_note_options(tenant_id,event_id,service_type,snapshot_id,code,label,display_order) values ('${requested.tenantId}','${requested.eventId}','business','${serviceSnapshotId}','positive','Positive',1)`,
      `insert into interaction_slots(id,tenant_id,event_id,service_type,source,source_ref,status) values ('${serviceSlotId}','${requested.tenantId}','${requested.eventId}','business','operator_import','service-noise','active')`,
      ...requested.participantIds.map(
        (participantId) =>
          `insert into interaction_slot_participants(tenant_id,event_id,service_type,interaction_slot_id,participant_id) values ('${requested.tenantId}','${requested.eventId}','business','${serviceSlotId}','${participantId}')`,
      ),
      ...requested.participantIds
        .slice(0, 5)
        .map(
          (participantId) =>
            `insert into interaction_notes(tenant_id,event_id,service_type,snapshot_id,actor_participant_id,target_participant_id,interaction_slot_id,feeling_code,favorite,wants_to_talk_more,private_note_text) values ('${requested.tenantId}','${requested.eventId}','business','${serviceSnapshotId}','${participantId}','${requested.participantIds[5]}','${serviceSlotId}','positive',true,true,'service-private')`,
        ),
      `insert into match_chat_rooms(id,tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,status,opens_at,closes_at) values ('${serviceRoomId}','${requested.tenantId}','${requested.eventId}','business','${id(1, 300)}','${requested.participantIds[0]}','${requested.participantIds[3]}','open',now(),now()+interval '72 hours')`,
      `insert into match_chat_messages(tenant_id,event_id,room_id,sender_participant_id,client_message_id,encrypted_body,encryption_version,sent_at,expires_at) values ('${requested.tenantId}','${requested.eventId}','${serviceRoomId}','${requested.participantIds[0]}','${id(4, 500)}','service-encrypted-private','v1',now(),now()+interval '30 days')`,
      `insert into match_chat_reports(tenant_id,event_id,room_id,reporter_participant_id,reported_participant_id,category,detail) values ('${requested.tenantId}','${requested.eventId}','${serviceRoomId}','${requested.participantIds[0]}','${requested.participantIds[3]}','other','service-private-report')`,
    ];
    await client.exec(
      [...requested.statements, ...otherTenant.statements, ...otherEvent.statements, ...serviceNoise].join(";\n"),
    );
    const pgliteDatabase = drizzle(client, { schema }) as unknown as ReturnType<typeof getDatabase>;
    const result = await createDrizzleOperationsAnalyticsRepository(pgliteDatabase).load({
      tenantId: requested.tenantId,
      eventId: requested.eventId,
      serviceType: "marriage",
    });

    expect(result).toMatchObject({
      eventName: "Event 1",
      interaction: { cohortSize: 5, memoCount: 5, favoriteCount: 3, wantsToTalkMoreCount: 4 },
      matchChat: { cohortSize: 6, roomCount: 3, openRoomCount: 3, messageCount: 1, reportCount: 1 },
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("private-1");
    expect(json).not.toContain(requested.tenantId);
    expect(json).not.toContain(requested.eventId);
    expect(json).not.toContain("private-report-1");
  }, 30_000);
});
