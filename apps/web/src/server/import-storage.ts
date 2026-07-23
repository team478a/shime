import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const storageEnv = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_IMPORT_BUCKET: z.string().min(1),
});
export async function storeImportOriginal(input: {
  tenantId: string;
  eventId: string;
  importId: string;
  bytes: Uint8Array;
}) {
  const env = storageEnv.parse(process.env);
  const path = `${input.tenantId}/${input.eventId}/${input.importId}.csv`;
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.storage
    .from(env.SUPABASE_IMPORT_BUCKET)
    .upload(path, input.bytes, { contentType: "text/csv; charset=utf-8", upsert: false });
  if (result.error) throw new Error(`Import storage failed: ${result.error.message}`);
  return path;
}
