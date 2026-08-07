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

function seed(scope: number) {
  const tenantId = id(scope, 1);
  const eventId = id(scope, 2);
  const userId = id(scope, 3);
  const applicationIds = [id(scope, 10), id(scope, 11)];
  const participantIds = [id(scope, 20), id(scope, 21)];
  const matchId = id(scope, 30);
  const sql = [
    `insert into tenants(id,code,name,status,timezone) values ('${tenantId}','chat-${scope}','Chat ${scope}','active','Asia/Tokyo')`,
    `insert into users(id,tenant_id,user_type,status,display_name) values ('${userId}','${tenantId}','staff','active','Staff')`,
    `insert into events(id,tenant_id,code,name,status,starts_at,capacity,dream_registration_mode,preference_mode,allow_multiple_matches,result_publish_at) values ('${eventId}','${tenantId}','event-${scope}','Event','result_confirmed',now(),20,'optional','first_choice_only',false,now())`,
    ...applicationIds.map(
      (applicationId, index) =>
        `insert into applications(id,tenant_id,event_id,source,status,full_name,birth_date,participant_category) values ('${applicationId}','${tenantId}','${eventId}','shime_form','confirmed','P${index}','1990-01-01','group_a')`,
    ),
    ...participantIds.map(
      (participantId, index) =>
        `insert into participants(id,tenant_id,event_id,application_id,participant_number,status,dream_state) values ('${participantId}','${tenantId}','${eventId}','${applicationIds[index]}','A0${index + 1}','confirmed','skipped')`,
    ),
    `insert into match_candidates(id,tenant_id,event_id,participant_a_id,participant_b_id,status) values ('${matchId}','${tenantId}','${eventId}','${participantIds[0]}','${participantIds[1]}','approved')`,
  ].join(";\n");
  return { tenantId, eventId, userId, participantIds, matchId, sql };
}

describe("match chat migration scope", () => {
  it("keeps chat disabled by default and requires terms and retention before enablement", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const scope = seed(1);
    await client.exec(`${scope.sql};`);
    await expect(
      client.exec(
        `insert into event_match_chat_configs(tenant_id,event_id,service_type,updated_by) values ('${scope.tenantId}','${scope.eventId}','marriage','${scope.userId}')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `update event_match_chat_configs set enabled=true where tenant_id='${scope.tenantId}' and event_id='${scope.eventId}'`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `update event_match_chat_configs set enabled=true,terms_version='chat-v1',retention_days=30 where tenant_id='${scope.tenantId}' and event_id='${scope.eventId}'`,
      ),
    ).resolves.toBeDefined();
  }, 30_000);

  it("accepts the approved pair and rejects cross-tenant or altered pairs", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const first = seed(2);
    const second = seed(3);
    await client.exec(`${first.sql};\n${second.sql};`);
    const roomId = id(2, 40);
    await expect(
      client.exec(
        `insert into match_chat_rooms(id,tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,closes_at) values ('${roomId}','${first.tenantId}','${first.eventId}','marriage','${first.matchId}','${first.participantIds[0]}','${first.participantIds[1]}',now()+interval '72 hours')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `insert into match_chat_rooms(tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,closes_at) values ('${first.tenantId}','${first.eventId}','business','${first.matchId}','${first.participantIds[1]}','${first.participantIds[0]}',now()+interval '72 hours')`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `insert into match_chat_consents(tenant_id,event_id,room_id,participant_id,terms_version,accepted_at) values ('${second.tenantId}','${second.eventId}','${roomId}','${second.participantIds[0]}','chat-v1',now())`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("stores only encrypted messages and rejects cross-event sender scope and duplicate retries", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const first = seed(4);
    const second = seed(5);
    await client.exec(`${first.sql};\n${second.sql};`);
    const roomId = id(4, 40);
    const messageId = id(4, 50);
    const clientMessageId = id(4, 51);
    await client.exec(
      `insert into match_chat_rooms(id,tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,status,opens_at,closes_at) values ('${roomId}','${first.tenantId}','${first.eventId}','marriage','${first.matchId}','${first.participantIds[0]}','${first.participantIds[1]}','open',now(),now()+interval '72 hours')`,
    );
    await expect(
      client.exec(
        `insert into match_chat_messages(id,tenant_id,event_id,room_id,sender_participant_id,client_message_id,encrypted_body,encryption_version,sent_at,expires_at) values ('${messageId}','${first.tenantId}','${first.eventId}','${roomId}','${first.participantIds[0]}','${clientMessageId}','ciphertext-only','v1',now(),now()+interval '30 days')`,
      ),
    ).resolves.toBeDefined();
    const stored = await client.query<{ encrypted_body: string }>(
      `select encrypted_body from match_chat_messages where id='${messageId}'`,
    );
    expect(stored.rows).toEqual([{ encrypted_body: "ciphertext-only" }]);
    await expect(
      client.exec(
        `insert into match_chat_messages(tenant_id,event_id,room_id,sender_participant_id,client_message_id,encrypted_body,encryption_version,sent_at,expires_at) values ('${first.tenantId}','${first.eventId}','${roomId}','${first.participantIds[0]}','${clientMessageId}','changed','v1',now(),now()+interval '30 days')`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `insert into match_chat_messages(tenant_id,event_id,room_id,sender_participant_id,client_message_id,encrypted_body,encryption_version,sent_at,expires_at) values ('${first.tenantId}','${first.eventId}','${roomId}','${second.participantIds[0]}','${id(4, 52)}','cross-scope','v1',now(),now()+interval '30 days')`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("keeps reports and resolver identities inside the room tenant and event", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const first = seed(6);
    const second = seed(7);
    await client.exec(`${first.sql};\n${second.sql};`);
    const roomId = id(6, 40);
    const reportId = id(6, 60);
    await client.exec(
      `insert into match_chat_rooms(id,tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,status,opens_at,closes_at) values ('${roomId}','${first.tenantId}','${first.eventId}','marriage','${first.matchId}','${first.participantIds[0]}','${first.participantIds[1]}','blocked',now(),now()+interval '72 hours')`,
    );
    await expect(
      client.exec(
        `insert into match_chat_reports(id,tenant_id,event_id,room_id,reporter_participant_id,reported_participant_id,category) values ('${reportId}','${first.tenantId}','${first.eventId}','${roomId}','${first.participantIds[0]}','${first.participantIds[1]}','safety_concern')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      client.exec(
        `insert into match_chat_reports(tenant_id,event_id,room_id,reporter_participant_id,reported_participant_id,category) values ('${second.tenantId}','${second.eventId}','${roomId}','${second.participantIds[0]}','${second.participantIds[1]}','spam')`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `update match_chat_reports set status='resolved',resolved_at=now(),resolved_by='${second.userId}' where id='${reportId}'`,
      ),
    ).rejects.toThrow();
  }, 30_000);

  it("supports bounded physical deletion of expired encrypted messages", async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder: "packages/db/migrations" });
    const scope = seed(8);
    await client.exec(`${scope.sql};`);
    const roomId = id(8, 40);
    await client.exec(
      `insert into match_chat_rooms(id,tenant_id,event_id,service_type,match_candidate_id,participant_a_id,participant_b_id,status,opens_at,closes_at) values ('${roomId}','${scope.tenantId}','${scope.eventId}','marriage','${scope.matchId}','${scope.participantIds[0]}','${scope.participantIds[1]}','open',now(),now()+interval '72 hours')`,
    );
    for (const [item, expiry] of [
      [70, "-1 day"],
      [71, "+30 days"],
    ] as const) {
      await client.exec(
        `insert into match_chat_messages(id,tenant_id,event_id,room_id,sender_participant_id,client_message_id,encrypted_body,encryption_version,sent_at,expires_at) values ('${id(8, item)}','${scope.tenantId}','${scope.eventId}','${roomId}','${scope.participantIds[0]}','${id(8, item + 10)}','ciphertext','v1',now()-interval '2 days',now()+interval '${expiry}')`,
      );
    }
    await client.exec(
      `delete from match_chat_messages where id in (select id from match_chat_messages where expires_at <= now() order by expires_at,id limit 5000)`,
    );
    const remaining = await client.query<{ id: string }>(
      `select id from match_chat_messages where tenant_id='${scope.tenantId}' order by id`,
    );
    expect(remaining.rows).toEqual([{ id: id(8, 71) }]);
  }, 30_000);
});
