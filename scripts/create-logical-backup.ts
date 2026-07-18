import "dotenv/config";

import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.literal("staging"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  DATABASE_MIGRATION_URL: z.string().startsWith("postgresql://"),
});

async function main() {
  const env = envSchema.parse(process.env);
  const outputDirectory = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("An output directory outside the repository is required");
  const repository = path.resolve(process.cwd());
  const relative = path.relative(repository, outputDirectory);
  if (!relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Backup output must be outside the repository");
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const dockerLookup = spawnSync("where.exe", ["docker.exe"], { encoding: "utf8", windowsHide: true });
  const installedDocker = process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Docker", "Docker", "resources", "bin", "docker.exe") : "";
  const dockerExecutable = dockerLookup.stdout?.split(/\r?\n/).find(Boolean) ?? (installedDocker && existsSync(installedDocker) ? installedDocker : undefined);
  if (!dockerExecutable) throw new Error("Docker executable was not found");
  const backupDatabaseUrl = env.DATABASE_URL;
  const database = new URL(backupDatabaseUrl);
  const databaseEnvironment = {
    ...process.env,
    PATH: `${path.dirname(dockerExecutable)}${path.delimiter}${process.env.PATH ?? ""}`,
    PGHOST: database.hostname,
    PGPORT: database.port || "5432",
    PGDATABASE: database.pathname.replace(/^\//, "") || "postgres",
    PGUSER: decodeURIComponent(database.username),
    PGPASSWORD: decodeURIComponent(database.password),
    PGSSLMODE: "require",
  };

  const dumps = [
    { name: "roles.sql", command: "pg_dumpall", args: ["--roles-only", "--no-role-passwords", "--file=/backup/roles.sql"] },
    { name: "schema.sql", command: "pg_dump", args: ["--schema-only", "--no-owner", "--no-privileges", "--file=/backup/schema.sql"] },
    { name: "data.sql", command: "pg_dump", args: ["--data-only", "--no-owner", "--no-privileges", "--format=plain", "--exclude-table=storage.buckets_vectors", "--exclude-table=storage.vector_indexes", "--file=/backup/data.sql"] },
  ] as const;
  for (const dump of dumps) {
    const file = path.join(outputDirectory, dump.name);
    const result = spawnSync(dockerExecutable, ["run", "--rm", "--volume", `${outputDirectory}:/backup`, "--env", "PGHOST", "--env", "PGPORT", "--env", "PGDATABASE", "--env", "PGUSER", "--env", "PGPASSWORD", "--env", "PGSSLMODE", "postgres:17", dump.command, ...dump.args], {
      cwd: repository,
      env: databaseEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10 * 60 * 1000,
    });
    if (result.status !== 0) {
      const diagnostic = [result.error?.message, result.stderr?.toString("utf8"), result.stdout?.toString("utf8")].filter(Boolean).join("\n")
        .replaceAll(env.DATABASE_MIGRATION_URL, "[REDACTED_DATABASE_URL]")
        .replaceAll(backupDatabaseUrl, "[REDACTED_DATABASE_URL]")
        .replaceAll(databaseEnvironment.PGPASSWORD, "[REDACTED_PASSWORD]")
        .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]")
        .replace(/password\s*[=:]\s*\S+/gi, "password=[REDACTED]")
        .trim()
        .slice(0, 1000);
      throw new Error(`Logical backup failed for ${dump.name}${diagnostic ? `: ${diagnostic}` : ""}`);
    }
    await chmod(file, 0o600);
  }

  const files = await Promise.all(dumps.map(async ({ name }) => {
    const file = path.join(outputDirectory, name);
    const info = await stat(file);
    if (info.size === 0) throw new Error(`Logical backup is empty: ${name}`);
    const sha256 = createHash("sha256").update(await readFile(file)).digest("hex");
    return { name, bytes: info.size, sha256 };
  }));
  console.info(JSON.stringify({ status: "ok", outputDirectory, files }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Logical backup failed");
  process.exitCode = 1;
});
