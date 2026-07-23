import "dotenv/config";
import postgres from "postgres";
async function count(url: string) {
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const tables = await sql.unsafe<{ count: number }[]>(
      "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
    );
    const migrations = await sql.unsafe<{ count: number }[]>(
      "select count(*)::int as count from drizzle.__drizzle_migrations",
    );
    return { publicTableCount: tables[0]?.count ?? 0, migrationCount: migrations[0]?.count ?? 0 };
  } finally {
    await sql.end();
  }
}
async function main() {
  const migrationUrl = process.env.DATABASE_MIGRATION_URL;
  const runtimeUrl = process.env.DATABASE_URL;
  if (!migrationUrl || !runtimeUrl) throw new Error("DATABASE_URL and DATABASE_MIGRATION_URL are required");
  const migration = await count(migrationUrl);
  const runtime = await count(runtimeUrl);
  console.info(
    JSON.stringify({
      migrationConnection: "ok",
      runtimeConnection: "ok",
      ...migration,
      sameDatabase:
        migration.publicTableCount === runtime.publicTableCount && migration.migrationCount === runtime.migrationCount,
    }),
  );
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Supabase verification failed");
  process.exitCode = 1;
});
