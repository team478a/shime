import { and, eq } from "drizzle-orm";
import { FallbackDreamProvider, OpenAIDreamProvider, type DreamSuggestionProvider } from "@shime/core";
import { getDatabase, tenantServiceSettings } from "@shime/db";
import { decryptSecrets } from "./secret-store";

export async function getDreamProvider(
  tenantId: string,
  fallback: { bridgeTemplate: string; candidates: string[] },
  aiEnabled: boolean,
  timeoutMs: number,
): Promise<{ primary: DreamSuggestionProvider | null; fallback: DreamSuggestionProvider }> {
  const fixed = new FallbackDreamProvider(fallback);
  if (!aiEnabled) return { primary: null, fallback: fixed };
  const setting = (
    await getDatabase()
      .select()
      .from(tenantServiceSettings)
      .where(and(eq(tenantServiceSettings.tenantId, tenantId), eq(tenantServiceSettings.serviceKey, "openai")))
      .limit(1)
  )[0];
  if (!setting?.enabled) return { primary: null, fallback: fixed };
  let secrets: Record<string, string> = {};
  if (setting?.encryptedSecrets) secrets = decryptSecrets(setting.encryptedSecrets);
  const apiKey = secrets.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { primary: null, fallback: fixed };
  return {
    primary: new OpenAIDreamProvider({ apiKey, model: String(setting?.config.model ?? "gpt-5.4-mini"), timeoutMs }),
    fallback: fixed,
  };
}
