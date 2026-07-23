import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PrivateObjectStorageProvider } from "@shime/core";

const storageEnv = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_CONCIERGE_BUCKET: z.string().min(1),
});

export function createConciergeStorageProvider(): PrivateObjectStorageProvider {
  const env = storageEnv.parse(process.env);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async uploadImmutable(input) {
      const result = await client.storage
        .from(env.SUPABASE_CONCIERGE_BUCKET)
        .upload(input.objectKey, input.bytes, { contentType: input.contentType, upsert: false });
      if (result.error) throw new Error("CONCIERGE_STORAGE_UPLOAD_FAILED");
    },
    async createSignedReadUrl(objectKey, expiresInSeconds) {
      const result = await client.storage
        .from(env.SUPABASE_CONCIERGE_BUCKET)
        .createSignedUrl(objectKey, expiresInSeconds);
      if (result.error || !result.data.signedUrl) throw new Error("CONCIERGE_STORAGE_SIGN_FAILED");
      return result.data.signedUrl;
    },
  };
}
