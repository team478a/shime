import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required");

const { db, client } = createDatabase(url);
await migrate(db, { migrationsFolder: "packages/db/migrations" });
await client.end();
