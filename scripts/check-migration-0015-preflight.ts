import "dotenv/config";

import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { collectMigration0015Readiness } from "./migration-0015-readiness";

const envSchema = z.object({
  DATABASE_MIGRATION_URL: z.string().startsWith("postgresql://"),
});

async function main() {
  const env = envSchema.parse(process.env);
  const result = await collectMigration0015Readiness(env.DATABASE_MIGRATION_URL, "preflight");
  console.info(JSON.stringify(result, null, 2));
  if (!result.safe) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError ? "MIGRATION_0015_PREFLIGHT_ENV_INVALID" : "MIGRATION_0015_PREFLIGHT_FAILED",
    );
    process.exitCode = 1;
  });
}
