import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().startsWith("sb_secret_"),
  SUPABASE_IMPORT_BUCKET: z.string().min(1),
});

async function main() {
  const env = envSchema.parse(process.env);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.storage.getBucket(env.SUPABASE_IMPORT_BUCKET);

  if (error) {
    throw new Error(`Storage verification failed (${error.statusCode ?? "unknown"})`);
  }

  console.info(
    JSON.stringify({
      connection: "ok",
      bucketExists: Boolean(data),
      public: data?.public ?? null,
    }),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Storage verification failed");
  process.exitCode = 1;
});
