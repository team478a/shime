import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

let client: PGlite | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

function id(scope: number, n: number) {
  return `${scope}0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function seedTenantScope(scope: number, participantCount = 1) {
  const tenantId = id(scope, 1);
  const eventId = id(scope, 2);
  const userId = id(scope, 3);
  const templateId = id(scope, 4);
  const templateVersionId = id(scope, 5);
  const snapshotId = id(scope, 6);
  const applicationIds = Array.from({ length: participantCount }, (_, index) => id(scope, 10 + index));
  const participantIds = Array.from({ length: participantCount }, (_, index) => id(scope, 20 + index));
  const sessionIds = Array.from({ length: participantCount }, (_, index) => id(scope, 30 + index));

  const statements = [
    `insert into tenants(id, code, name, status, timezone) values ('${tenantId}','t${scope}','Tenant ${scope}','active','Asia/Tokyo');`,
    `insert into events(id, tenant_id, code, name, status, starts_at, capacity, dream_registration_mode, preference_mode, allow_multiple_matches) values ('${eventId}','${tenantId}','e${scope}','Event ${scope}','draft',now(),10,'optional','first_choice_only',false);`,
    `insert into users(id, tenant_id, user_type, status, display_name) values ('${userId}','${tenantId}','staff','active','Staff ${scope}');`,
    `insert into concierge_templates(id, tenant_id, template_key, name, created_by) values ('${templateId}','${tenantId}','tpl-${scope}','Template ${scope}','${userId}');`,
    `insert into concierge_template_versions(id, tenant_id, template_id, version, payload_json, created_by) values ('${templateVersionId}','${tenantId}','${templateId}',1,'{}'::jsonb,'${userId}');`,
    `insert into event_concierge_snapshots(id, tenant_id, event_id, template_version_id, template_version, snapshot_json, snapshot_hash, enabled, applied_by) values ('${snapshotId}','${tenantId}','${eventId}','${templateVersionId}',1,'{}'::jsonb,'${"h".repeat(64)}',true,'${userId}');`,
  ];
  for (let index = 0; index < participantCount; index += 1) {
    statements.push(
      `insert into applications(id, tenant_id, event_id, source, status, full_name, birth_date, participant_category) values ('${applicationIds[index]}','${tenantId}','${eventId}','shime_form','confirmed','P${scope}-${index}','1990-01-01','a');`,
      `insert into participants(id, tenant_id, event_id, application_id, status, dream_state) values ('${participantIds[index]}','${tenantId}','${eventId}','${applicationIds[index]}','confirmed','skipped');`,
      `insert into concierge_sessions(id, tenant_id, event_id, participant_id, snapshot_id) values ('${sessionIds[index]}','${tenantId}','${eventId}','${participantIds[index]}','${snapshotId}');`,
    );
  }
  return {
    tenantId,
    eventId,
    userId,
    templateId,
    templateVersionId,
    snapshotId,
    participantIds,
    sessionIds,
    sql: statements.join("\n"),
  };
}

/** A second event (with its own participant) inside an already-seeded tenant. */
function seedSecondEvent(scope: number, tenantId: string) {
  const eventId = id(scope, 50);
  const applicationId = id(scope, 51);
  const participantId = id(scope, 52);
  const sql = [
    `insert into events(id, tenant_id, code, name, status, starts_at, capacity, dream_registration_mode, preference_mode, allow_multiple_matches) values ('${eventId}','${tenantId}','e${scope}b','Event ${scope}B','draft',now(),10,'optional','first_choice_only',false);`,
    `insert into applications(id, tenant_id, event_id, source, status, full_name, birth_date, participant_category) values ('${applicationId}','${tenantId}','${eventId}','shime_form','confirmed','P${scope}B','1990-01-01','a');`,
    `insert into participants(id, tenant_id, event_id, application_id, status, dream_state) values ('${participantId}','${tenantId}','${eventId}','${applicationId}','confirmed','skipped');`,
  ].join("\n");
  return { eventId, participantId, sql };
}

/** A concierge card asset + published version inside an already-seeded tenant. */
function seedCardAssetVersion(scope: number, tenantId: string, userId: string) {
  const assetId = id(scope, 80);
  const versionId = id(scope, 81);
  const sql = [
    `insert into concierge_card_assets(id, tenant_id, code, name, created_by) values ('${assetId}','${tenantId}','card-${scope}','Card ${scope}','${userId}');`,
    `insert into concierge_card_asset_versions(id, tenant_id, asset_id, version, status, title, message, alt_text, storage_object_key, mime_type, byte_size, width, height, pixel_count, content_hash, created_by) values ('${versionId}','${tenantId}','${assetId}',1,'draft','Title','Message','Alt','key/${scope}.webp','image/webp',1000,512,512,262144,'${"a".repeat(64)}','${userId}');`,
  ].join("\n");
  return { versionId, sql };
}

describe("concierge diagnosis migration and data isolation", () => {
  it("creates the concierge diagnosis tables introduced by migration 0015", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const names = result.rows.map((row) => row.table_name);
    expect(names).toContain("concierge_sessions");
    expect(names).toContain("concierge_answers");
    expect(names).toContain("concierge_answer_revisions");
    expect(names).toContain("concierge_rule_results");
    expect(names).toContain("concierge_access_logs");
  }, 20_000);

  it("rejects a second diagnosis session for the same participant in the same event", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);
    await client.exec(scope.sql);

    await expect(
      client.exec(
        `insert into concierge_sessions(tenant_id, event_id, participant_id, snapshot_id) values ('${scope.tenantId}','${scope.eventId}','${scope.participantIds[0]}','${scope.snapshotId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a duplicate answer for the same analysis axis within a session", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);
    await client.exec(scope.sql);
    const sessionId = scope.sessionIds[0];

    await client.exec(
      `insert into concierge_answers(tenant_id, event_id, session_id, axis_code, option_code) values ('${scope.tenantId}','${scope.eventId}','${sessionId}','axis_1','opt_a')`,
    );
    await expect(
      client.exec(
        `insert into concierge_answers(tenant_id, event_id, session_id, axis_code, option_code) values ('${scope.tenantId}','${scope.eventId}','${sessionId}','axis_1','opt_b')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a duplicate revision number for the same session's saved-draft history", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);
    await client.exec(scope.sql);
    const sessionId = scope.sessionIds[0];

    await client.exec(
      `insert into concierge_answer_revisions(tenant_id, event_id, session_id, revision, answer_snapshot_json) values ('${scope.tenantId}','${scope.eventId}','${sessionId}',1,'[]'::jsonb)`,
    );
    await expect(
      client.exec(
        `insert into concierge_answer_revisions(tenant_id, event_id, session_id, revision, answer_snapshot_json) values ('${scope.tenantId}','${scope.eventId}','${sessionId}',1,'[]'::jsonb)`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a duplicate submitted revision in the rule-based result history, preventing double submission", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);
    await client.exec(scope.sql);
    const sessionId = scope.sessionIds[0];

    await client.exec(
      `insert into concierge_rule_results(tenant_id, event_id, session_id, submitted_revision, algorithm_version, primary_emotion_code, result_snapshot_json) values ('${scope.tenantId}','${scope.eventId}','${sessionId}',1,'concierge-rule-v1','emotion_1','{}'::jsonb)`,
    );
    await expect(
      client.exec(
        `insert into concierge_rule_results(tenant_id, event_id, session_id, submitted_revision, algorithm_version, primary_emotion_code, result_snapshot_json) values ('${scope.tenantId}','${scope.eventId}','${sessionId}',1,'concierge-rule-v1','emotion_1','{}'::jsonb)`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("keeps one participant's answers isolated from another participant sharing the same tenant and event", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1, 2);
    await client.exec(scope.sql);
    const [firstSessionId, secondSessionId] = scope.sessionIds;

    await client.exec(`
      insert into concierge_answers(tenant_id, event_id, session_id, axis_code, option_code)
      values
        ('${scope.tenantId}','${scope.eventId}','${firstSessionId}','axis_1','opt_a'),
        ('${scope.tenantId}','${scope.eventId}','${firstSessionId}','axis_2','opt_a'),
        ('${scope.tenantId}','${scope.eventId}','${secondSessionId}','axis_1','opt_b');
    `);

    const firstAnswers = await client.query<{ axis_code: string; option_code: string }>(
      `select axis_code, option_code from concierge_answers where tenant_id = '${scope.tenantId}' and event_id = '${scope.eventId}' and session_id = '${firstSessionId}' order by axis_code`,
    );
    const secondAnswers = await client.query<{ axis_code: string; option_code: string }>(
      `select axis_code, option_code from concierge_answers where tenant_id = '${scope.tenantId}' and event_id = '${scope.eventId}' and session_id = '${secondSessionId}' order by axis_code`,
    );

    expect(firstAnswers.rows).toEqual([
      { axis_code: "axis_1", option_code: "opt_a" },
      { axis_code: "axis_2", option_code: "opt_a" },
    ]);
    expect(secondAnswers.rows).toEqual([{ axis_code: "axis_1", option_code: "opt_b" }]);
  }, 20_000);

  it("keeps sessions from different tenants isolated even when scoped by the same event-relative query", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    const tenantASessions = await client.query<{ id: string }>(
      `select id from concierge_sessions where tenant_id = '${tenantA.tenantId}'`,
    );
    const tenantBSessions = await client.query<{ id: string }>(
      `select id from concierge_sessions where tenant_id = '${tenantB.tenantId}'`,
    );

    expect(tenantASessions.rows.map((row) => row.id)).toEqual([tenantA.sessionIds[0]]);
    expect(tenantBSessions.rows.map((row) => row.id)).toEqual([tenantB.sessionIds[0]]);
    expect(tenantASessions.rows[0]?.id).not.toBe(tenantBSessions.rows[0]?.id);
  }, 20_000);

  it("keeps a full, ordered access-log history per participant without leaking another participant's log", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1, 2);
    await client.exec(scope.sql);
    const [firstParticipantId, secondParticipantId] = scope.participantIds;
    const [firstSessionId] = scope.sessionIds;

    await client.exec(`
      insert into concierge_access_logs(tenant_id, event_id, participant_id, session_id, viewer_user_id, action)
      values
        ('${scope.tenantId}','${scope.eventId}','${firstParticipantId}',null,'${scope.userId}','view'),
        ('${scope.tenantId}','${scope.eventId}','${firstParticipantId}','${firstSessionId}','${scope.userId}','start'),
        ('${scope.tenantId}','${scope.eventId}','${firstParticipantId}','${firstSessionId}','${scope.userId}','submit'),
        ('${scope.tenantId}','${scope.eventId}','${secondParticipantId}',null,'${scope.userId}','view');
    `);

    const firstParticipantLog = await client.query<{ action: string }>(
      `select action from concierge_access_logs where tenant_id = '${scope.tenantId}' and event_id = '${scope.eventId}' and participant_id = '${firstParticipantId}' order by created_at`,
    );

    expect(firstParticipantLog.rows.map((row) => row.action)).toEqual(["view", "start", "submit"]);
  }, 20_000);

  it("rejects a diagnosis session pointing at a non-existent event", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);
    await client.exec(scope.sql);

    await expect(
      client.exec(
        `insert into concierge_sessions(tenant_id, event_id, participant_id, snapshot_id) values ('${scope.tenantId}','00000000-0000-0000-0000-000000000099','${scope.participantIds[0]}','${scope.snapshotId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);
});

describe("concierge diagnosis cross-tenant / cross-event scope integrity", () => {
  it("accepts application, participant, and participant session references in the same scope", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);
    await client.exec(scope.sql);

    await client.exec(`update participants set user_id = '${scope.userId}' where id = '${scope.participantIds[0]}'`);
    await client.exec(
      `insert into participant_sessions(tenant_id, user_id, token_hash, expires_at) values ('${scope.tenantId}','${scope.userId}','${"s".repeat(64)}',now() + interval '1 hour')`,
    );

    const participant = await client.query<{ tenant_id: string; event_id: string; user_id: string }>(
      `select tenant_id, event_id, user_id from participants where id = '${scope.participantIds[0]}'`,
    );
    expect(participant.rows).toEqual([{ tenant_id: scope.tenantId, event_id: scope.eventId, user_id: scope.userId }]);
  }, 20_000);

  it("accepts a snapshot whose tenant and event belong to the same scope", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const scope = seedTenantScope(1);

    await client.exec(scope.sql);
    const snapshot = await client.query<{ tenant_id: string; event_id: string }>(
      `select tenant_id, event_id from event_concierge_snapshots where id = '${scope.snapshotId}'`,
    );

    expect(snapshot.rows).toEqual([{ tenant_id: scope.tenantId, event_id: scope.eventId }]);
  }, 20_000);

  it("rejects a snapshot whose event belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into event_concierge_snapshots(tenant_id, event_id, template_version_id, template_version, snapshot_json, snapshot_hash, enabled, applied_by) values ('${tenantA.tenantId}','${tenantB.eventId}','${id(1, 5)}',2,'{}'::jsonb,'${"i".repeat(64)}',true,'${tenantA.userId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a snapshot whose template version belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);
    const eventB = seedSecondEvent(1, tenantA.tenantId);
    await client.exec(eventB.sql);

    await expect(
      client.exec(
        `insert into event_concierge_snapshots(tenant_id, event_id, template_version_id, template_version, snapshot_json, snapshot_hash, enabled, applied_by) values ('${tenantA.tenantId}','${eventB.eventId}','${tenantB.templateVersionId}',1,'{}'::jsonb,'${"j".repeat(64)}',true,'${tenantA.userId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a snapshot whose applying user belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);
    const eventB = seedSecondEvent(1, tenantA.tenantId);
    await client.exec(eventB.sql);

    await expect(
      client.exec(
        `insert into event_concierge_snapshots(tenant_id, event_id, template_version_id, template_version, snapshot_json, snapshot_hash, enabled, applied_by) values ('${tenantA.tenantId}','${eventB.eventId}','${tenantA.templateVersionId}',1,'{}'::jsonb,'${"k".repeat(64)}',true,'${tenantB.userId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a Concierge template whose creator belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_templates(tenant_id, template_key, name, created_by) values ('${tenantA.tenantId}','cross-creator','Cross creator','${tenantB.userId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a Concierge template version whose template belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_template_versions(tenant_id, template_id, version, payload_json, created_by) values ('${tenantA.tenantId}','${tenantB.templateId}',2,'{}'::jsonb,'${tenantA.userId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a Concierge template version whose creator belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_template_versions(tenant_id, template_id, version, payload_json, created_by) values ('${tenantA.tenantId}','${tenantA.templateId}',2,'{}'::jsonb,'${tenantB.userId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a participant whose event belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into participants(tenant_id, event_id, application_id, status, dream_state) values ('${tenantA.tenantId}','${tenantB.eventId}','${id(1, 10)}','confirmed','skipped')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects an application whose event belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into applications(tenant_id, event_id, source, status, full_name, birth_date, participant_category) values ('${tenantA.tenantId}','${tenantB.eventId}','shime_form','confirmed','Cross tenant','1990-01-01','a')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a participant whose application belongs to a different tenant and event", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into participants(tenant_id, event_id, application_id, status, dream_state) values ('${tenantA.tenantId}','${tenantA.eventId}','${id(2, 10)}','confirmed','skipped')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a participant whose linked user belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(`update participants set user_id = '${tenantB.userId}' where id = '${tenantA.participantIds[0]}'`),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a participant session whose user belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into participant_sessions(tenant_id, user_id, token_hash, expires_at) values ('${tenantA.tenantId}','${tenantB.userId}','${"x".repeat(64)}',now() + interval '1 hour')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a session whose participant belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_sessions(tenant_id, event_id, participant_id, snapshot_id) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantB.participantIds[0]}','${tenantA.snapshotId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a session whose participant belongs to a different event in the same tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    await client.exec(tenantA.sql);
    const eventB = seedSecondEvent(1, tenantA.tenantId);
    await client.exec(eventB.sql);

    await expect(
      client.exec(
        `insert into concierge_sessions(tenant_id, event_id, participant_id, snapshot_id) values ('${tenantA.tenantId}','${tenantA.eventId}','${eventB.participantId}','${tenantA.snapshotId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a session whose snapshot belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_sessions(tenant_id, event_id, participant_id, snapshot_id) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantA.participantIds[0]}','${tenantB.snapshotId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a session whose selected card asset version belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);
    const cardB = seedCardAssetVersion(2, tenantB.tenantId, tenantB.userId);
    await client.exec(cardB.sql);

    await expect(
      client.exec(
        `insert into concierge_sessions(tenant_id, event_id, participant_id, snapshot_id, selected_card_asset_version_id) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantA.participantIds[0]}','${tenantA.snapshotId}','${cardB.versionId}')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects an answer whose session belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_answers(tenant_id, event_id, session_id, axis_code, option_code) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantB.sessionIds[0]}','axis_1','opt_a')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects an answer revision whose session belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_answer_revisions(tenant_id, event_id, session_id, revision, answer_snapshot_json) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantB.sessionIds[0]}',1,'[]'::jsonb)`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects a rule result whose session belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_rule_results(tenant_id, event_id, session_id, submitted_revision, algorithm_version, primary_emotion_code, result_snapshot_json) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantB.sessionIds[0]}',1,'concierge-rule-v1','emotion_1','{}'::jsonb)`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects an access log whose participant belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_access_logs(tenant_id, event_id, participant_id, viewer_user_id, action) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantB.participantIds[0]}','${tenantA.userId}','view')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects an access log whose session belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_access_logs(tenant_id, event_id, participant_id, session_id, viewer_user_id, action) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantA.participantIds[0]}','${tenantB.sessionIds[0]}','${tenantA.userId}','view')`,
      ),
    ).rejects.toThrow();
  }, 20_000);

  it("rejects an access log whose viewer belongs to a different tenant", async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "packages/db/migrations" });
    const tenantA = seedTenantScope(1);
    const tenantB = seedTenantScope(2);
    await client.exec(tenantA.sql);
    await client.exec(tenantB.sql);

    await expect(
      client.exec(
        `insert into concierge_access_logs(tenant_id, event_id, participant_id, viewer_user_id, action) values ('${tenantA.tenantId}','${tenantA.eventId}','${tenantA.participantIds[0]}','${tenantB.userId}','view')`,
      ),
    ).rejects.toThrow();
  }, 20_000);
});
