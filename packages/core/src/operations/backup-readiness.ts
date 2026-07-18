export type BackupMode = "unconfirmed" | "manual" | "daily" | "pitr";

export type BackupReadinessSnapshot = {
  backupMode: BackupMode;
  supabaseCliAvailable: boolean;
  dockerAvailable: boolean;
  dockerRunning: boolean;
  migrationCount: number;
  expectedMigrationCount: number;
  publicTableCount: number;
  storageBucketExists: boolean;
  storageBucketPrivate: boolean;
  storageObjectCount: number;
};

export type BackupReadinessIssue = {
  code: string;
  label: string;
  kind: "manual" | "tool" | "database" | "storage";
};

export function evaluateBackupReadiness(snapshot: BackupReadinessSnapshot) {
  const issues: BackupReadinessIssue[] = [];

  if (snapshot.backupMode === "unconfirmed") {
    issues.push({
      code: "BACKUP_MODE_UNCONFIRMED",
      label: "Supabase Dashboardでバックアップ方式を確認する",
      kind: "manual",
    });
  }
  if (!snapshot.supabaseCliAvailable) {
    issues.push({
      code: "SUPABASE_CLI_MISSING",
      label: "Supabase CLIまたはpnpm dlxを利用可能にする",
      kind: "tool",
    });
  }
  if (!snapshot.dockerAvailable) {
    issues.push({
      code: "DOCKER_MISSING",
      label: "Docker Desktopをインストールする",
      kind: "tool",
    });
  } else if (!snapshot.dockerRunning) {
    issues.push({
      code: "DOCKER_NOT_RUNNING",
      label: "Docker Desktopを起動する",
      kind: "tool",
    });
  }
  if (snapshot.publicTableCount < 1) {
    issues.push({
      code: "PUBLIC_SCHEMA_EMPTY",
      label: "publicスキーマを確認する",
      kind: "database",
    });
  }
  if (snapshot.migrationCount !== snapshot.expectedMigrationCount) {
    issues.push({
      code: "MIGRATION_COUNT_MISMATCH",
      label: "DBとリポジトリのマイグレーション数を一致させる",
      kind: "database",
    });
  }
  if (!snapshot.storageBucketExists) {
    issues.push({
      code: "STORAGE_BUCKET_MISSING",
      label: "バックアップ対象のStorage bucketを作成する",
      kind: "storage",
    });
  } else if (!snapshot.storageBucketPrivate) {
    issues.push({
      code: "STORAGE_BUCKET_PUBLIC",
      label: "取込ファイル用Storage bucketをprivateにする",
      kind: "storage",
    });
  }

  return {
    readyForBackupRehearsal: issues.length === 0,
    issues,
  };
}
