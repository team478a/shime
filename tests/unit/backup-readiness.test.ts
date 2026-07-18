import { describe, expect, it } from "vitest";
import { evaluateBackupReadiness, type BackupReadinessSnapshot } from "@shime/core";

const ready: BackupReadinessSnapshot = {
  backupMode: "daily",
  supabaseCliAvailable: true,
  dockerAvailable: true,
  dockerRunning: true,
  migrationCount: 8,
  expectedMigrationCount: 8,
  publicTableCount: 47,
  storageBucketExists: true,
  storageBucketPrivate: true,
  storageObjectCount: 0,
};

describe("backup rehearsal readiness", () => {
  it("accepts a configured and reproducible backup environment", () => {
    expect(evaluateBackupReadiness(ready)).toEqual({
      readyForBackupRehearsal: true,
      issues: [],
    });
  });

  it("reports manual, tooling, migration, and storage blockers", () => {
    const result = evaluateBackupReadiness({
      ...ready,
      backupMode: "unconfirmed",
      supabaseCliAvailable: false,
      dockerAvailable: false,
      dockerRunning: false,
      migrationCount: 7,
      storageBucketPrivate: false,
    });
    expect(result.readyForBackupRehearsal).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "BACKUP_MODE_UNCONFIRMED",
      "SUPABASE_CLI_MISSING",
      "DOCKER_MISSING",
      "MIGRATION_COUNT_MISMATCH",
      "STORAGE_BUCKET_PUBLIC",
    ]);
  });
});
