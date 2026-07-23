import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { HttpLineProvider } from "@shime/core";
import { getDatabase, tenantServiceSettings } from "@shime/db";
import { decryptSecrets } from "./secret-store";

const credentialsSchema = z.object({
  channelId: z.string().min(1),
  channelAccessToken: z.string().min(20),
  channelSecret: z.string().min(10),
});

export function resolveLineCredentials(
  config: Record<string, unknown> | undefined,
  secrets: Record<string, string>,
  environment: Record<string, string | undefined>,
) {
  return credentialsSchema.parse({
    channelId: config?.channelId ?? environment.LINE_CHANNEL_ID,
    channelAccessToken: secrets.accessToken ?? environment.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: secrets.channelSecret ?? environment.LINE_CHANNEL_SECRET,
  });
}

async function settings(tenantId: string) {
  return (
    await getDatabase()
      .select()
      .from(tenantServiceSettings)
      .where(and(eq(tenantServiceSettings.tenantId, tenantId), eq(tenantServiceSettings.serviceKey, "line")))
      .limit(1)
  )[0];
}

async function loadLineCredentials(tenantId: string) {
  const setting = await settings(tenantId);
  if (setting && !setting.enabled) throw new Error("LINE_DISABLED");
  const secrets = setting?.encryptedSecrets ? decryptSecrets(setting.encryptedSecrets) : {};
  return resolveLineCredentials(setting?.config, secrets, process.env);
}

export async function getLineProvider(tenantId: string) {
  const credentials = await loadLineCredentials(tenantId);
  return new HttpLineProvider({
    channelId: credentials.channelId,
    channelAccessToken: credentials.channelAccessToken,
  });
}

export async function getLineWebhookSecret(tenantId: string) {
  return (await loadLineCredentials(tenantId)).channelSecret;
}
