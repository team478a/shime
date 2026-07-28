import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  evaluateMigration0015Readiness,
  MIGRATION_0015_EXPECTED_CONSTRAINTS,
  MIGRATION_0015_EXPECTED_TABLES,
  MIGRATION_0015_SCOPE_CHECKS,
  MIGRATION_0015_TIMESTAMP,
} from "../../scripts/migration-0015-readiness";

const completeScopeChecks = MIGRATION_0015_SCOPE_CHECKS.map((check) => ({ key: check.key, count: 0 }));

describe("migration 0015 readiness", () => {
  it("accepts a fully verified postflight result", () => {
    expect(
      evaluateMigration0015Readiness({
        phase: "postflight",
        readOnly: true,
        migrationTimestamp: MIGRATION_0015_TIMESTAMP,
        expectedMigrationTimestamp: MIGRATION_0015_TIMESTAMP,
        scopeChecks: completeScopeChecks,
        missingConstraints: [],
        missingTables: [],
      }).safe,
    ).toBe(true);
  });

  it.each([
    ["connection is not read-only", { readOnly: false }],
    ["unexpected migration head", { migrationTimestamp: "unexpected" }],
    ["scope mismatch", { scopeChecks: [{ key: "applications_event_scope" as const, count: 1 }] }],
    ["missing constraint", { missingConstraints: ["events_tenant_id_uidx"] }],
    ["missing table", { missingTables: ["concierge_sessions"] }],
  ])("rejects %s", (_label, override) => {
    const result = evaluateMigration0015Readiness({
      phase: "postflight",
      readOnly: true,
      migrationTimestamp: MIGRATION_0015_TIMESTAMP,
      expectedMigrationTimestamp: MIGRATION_0015_TIMESTAMP,
      scopeChecks: completeScopeChecks,
      missingConstraints: [],
      missingTables: [],
      ...override,
    });
    expect(result.safe).toBe(false);
  });

  it("keeps the postflight contract synchronized with migration 0015", () => {
    const migration = readFileSync("packages/db/migrations/0015_strange_mandroid.sql", "utf8");
    for (const constraint of MIGRATION_0015_EXPECTED_CONSTRAINTS) {
      expect(migration).toContain(`"${constraint.name}"`);
    }
    for (const table of MIGRATION_0015_EXPECTED_TABLES) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("rejects missing or duplicate scope checks", () => {
    const base = {
      phase: "preflight" as const,
      readOnly: true,
      migrationTimestamp: MIGRATION_0015_TIMESTAMP,
      expectedMigrationTimestamp: MIGRATION_0015_TIMESTAMP,
      missingConstraints: [],
      missingTables: [],
    };

    expect(evaluateMigration0015Readiness({ ...base, scopeChecks: completeScopeChecks }).safe).toBe(true);
    expect(evaluateMigration0015Readiness({ ...base, scopeChecks: completeScopeChecks.slice(1) }).safe).toBe(false);
    expect(
      evaluateMigration0015Readiness({
        ...base,
        scopeChecks: [...completeScopeChecks, completeScopeChecks[0]!],
      }).safe,
    ).toBe(false);
  });
});
