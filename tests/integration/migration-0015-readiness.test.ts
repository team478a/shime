import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

import { MIGRATION_0015_SCOPE_CHECKS } from "../../scripts/migration-0015-readiness";

let client: PGlite | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

async function runScopeChecks() {
  if (!client) throw new Error("TEST_DATABASE_NOT_INITIALIZED");
  return Promise.all(
    MIGRATION_0015_SCOPE_CHECKS.map(async (check) => {
      const result = await client!.query<{ count: number }>(check.query);
      return { key: check.key, count: result.rows[0]?.count ?? -1 };
    }),
  );
}

describe("migration 0015 scope preflight", () => {
  it("accepts valid scope relationships and detects every mismatch class", async () => {
    client = new PGlite();
    await client.exec(`
      create table events (id text, tenant_id text);
      create table users (id text, tenant_id text);
      create table applications (id text, tenant_id text, event_id text);
      create table participants (
        id text, tenant_id text, event_id text, application_id text, user_id text
      );
      create table participant_sessions (id text, tenant_id text, user_id text);
      create table concierge_templates (id text, tenant_id text, created_by text);
      create table concierge_template_versions (
        id text, tenant_id text, template_id text, version integer, created_by text
      );
      create table event_concierge_snapshots (
        id text, tenant_id text, event_id text, template_version_id text,
        template_version integer, applied_by text
      );

      insert into events values ('event-a', 'tenant-a');
      insert into users values ('user-a', 'tenant-a');
      insert into applications values ('application-a', 'tenant-a', 'event-a');
      insert into participants
        values ('participant-a', 'tenant-a', 'event-a', 'application-a', 'user-a');
      insert into participant_sessions values ('session-a', 'tenant-a', 'user-a');
      insert into concierge_templates values ('template-a', 'tenant-a', 'user-a');
      insert into concierge_template_versions
        values ('version-a', 'tenant-a', 'template-a', 1, 'user-a');
      insert into event_concierge_snapshots
        values ('snapshot-a', 'tenant-a', 'event-a', 'version-a', 1, 'user-a');
      `);

    const validResults = await runScopeChecks();
    expect(validResults.every((result) => result.count === 0)).toBe(true);

    await client.exec(`
      insert into applications values ('application-x', 'tenant-x', 'event-a');
      insert into participants
        values ('participant-x', 'tenant-x', 'event-a', 'application-a', 'user-a');
      insert into participant_sessions values ('session-x', 'tenant-x', 'user-a');
      insert into concierge_templates values ('template-x', 'tenant-x', 'user-a');
      insert into concierge_template_versions
        values ('version-x', 'tenant-x', 'template-a', 1, 'user-a');
      insert into event_concierge_snapshots
        values ('snapshot-x', 'tenant-x', 'event-a', 'version-a', 1, 'user-a');
      `);

    const invalidResults = await runScopeChecks();
    expect(invalidResults.every((result) => result.count > 0)).toBe(true);
  }, 15_000);
});
