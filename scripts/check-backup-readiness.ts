import "dotenv/config";

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { z } from "zod";
import { evaluateBackupReadiness, type BackupMode } from "@shime/core";

const envSchema = z.object({
  DATABASE_MIGRATION_URL: z.string().startsWith("postgresql://"),
  SUPABASE_IMPORT_BUCKET: z.string().min(1),
  SUPABASE_BACKUP_MODE: z
    .enum(["unconfirmed", "manual", "daily", "pitr"])
    .default("unconfirmed"),
});

function commandAvailable(command: string) {
  return spawnSync("where.exe", [command], { stdio: "ignore", timeout: 5_000 }).status === 0;
}

function dockerExecutable() {
  if (commandAvailable("docker")) return "docker";
  const programFiles = process.env.ProgramFiles;
  if (!programFiles) return null;
  const installedPath = path.join(
    programFiles,
    "Docker",
    "Docker",
    "resources",
    "bin",
    "docker.exe",
  );
  return existsSync(installedPath) ? installedPath : null;
}

function dockerRunning(executable: string) {
  const desktopStatus = spawnSync(executable, ["desktop", "status"], {
    stdio: "ignore",
    timeout: 10_000,
  });
  if (desktopStatus.status === 0) return true;
  return spawnSync(executable, ["info"], { stdio: "ignore", timeout: 20_000 }).status === 0;
}

async function expectedMigrationCount() {
  const entries = await readdir(path.resolve("packages/db/migrations"));
  return entries.filter((entry) => /^\d{4}_.+\.sql$/.test(entry)).length;
}

export async function collectBackupReadiness(input: {
  databaseUrl: string;
  bucket: string;
  backupMode: BackupMode;
}) {
  const sql = postgres(input.databaseUrl, { max: 1, prepare: false });
  try {
    const [stats] = await sql<{
      migration_count: number;
      public_table_count: number;
      bucket_exists: boolean;
      bucket_private: boolean;
      storage_object_count: number;
    }[]>`
      select
        (select count(*)::int from drizzle.__drizzle_migrations) as migration_count,
        (select count(*)::int from information_schema.tables where table_schema = 'public') as public_table_count,
        exists(select 1 from storage.buckets where id = ${input.bucket}) as bucket_exists,
        coalesce((select not public from storage.buckets where id = ${input.bucket}), false) as bucket_private,
        (select count(*)::int from storage.objects where bucket_id = ${input.bucket}) as storage_object_count
    `;
    if (!stats) throw new Error("BACKUP_READINESS_QUERY_EMPTY");

    const supabaseCliAvailable = commandAvailable("supabase") || commandAvailable("pnpm");
    const docker = dockerExecutable();
    const dockerAvailable = docker !== null;
    return {
      backupMode: input.backupMode,
      supabaseCliAvailable,
      dockerAvailable,
      dockerRunning: docker ? dockerRunning(docker) : false,
      migrationCount: stats.migration_count,
      expectedMigrationCount: await expectedMigrationCount(),
      publicTableCount: stats.public_table_count,
      storageBucketExists: stats.bucket_exists,
      storageBucketPrivate: stats.bucket_private,
      storageObjectCount: stats.storage_object_count,
    };
  } finally {
    await sql.end();
  }
}

async function main() {
  const env = envSchema.parse(process.env);
  const snapshot = await collectBackupReadiness({
    databaseUrl: env.DATABASE_MIGRATION_URL,
    bucket: env.SUPABASE_IMPORT_BUCKET,
    backupMode: env.SUPABASE_BACKUP_MODE,
  });
  console.info(JSON.stringify({ ...snapshot, ...evaluateBackupReadiness(snapshot) }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    const code = error instanceof z.ZodError
      ? "BACKUP_READINESS_ENV_INVALID"
      : error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "BACKUP_READINESS_FAILED";
    console.error(code);
    process.exitCode = 1;
  });
}
