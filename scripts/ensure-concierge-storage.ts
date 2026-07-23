import "dotenv/config.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const env = z
  .object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    SUPABASE_CONCIERGE_BUCKET: z.string().min(1).default("shime-private-concierge"),
  })
  .parse(process.env);

async function main() {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const listed = await client.storage.listBuckets();
  if (listed.error) throw new Error("CONCIERGE_STORAGE_LIST_FAILED");
  const existing = listed.data.find((bucket) => bucket.id === env.SUPABASE_CONCIERGE_BUCKET);

  if (!existing) {
    const created = await client.storage.createBucket(env.SUPABASE_CONCIERGE_BUCKET, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/webp"],
    });
    if (created.error) throw new Error("CONCIERGE_STORAGE_CREATE_FAILED");
  } else if (existing.public) {
    throw new Error("CONCIERGE_STORAGE_MUST_BE_PRIVATE");
  }

  const verified = await client.storage.getBucket(env.SUPABASE_CONCIERGE_BUCKET);
  if (verified.error || !verified.data || verified.data.public) {
    throw new Error("CONCIERGE_STORAGE_VERIFY_FAILED");
  }

  console.log(`Concierge private bucket is ready: ${env.SUPABASE_CONCIERGE_BUCKET}`);
}

void main();
