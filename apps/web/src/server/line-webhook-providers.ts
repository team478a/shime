import { z } from "zod";
import type { LineWebhookSecretProvider, WebhookPepperProvider } from "@shime/integrations";
import { getLineWebhookSecret } from "./line-provider";

const envSchema = z.object({ SESSION_PEPPER: z.string().min(32) });

export class ConfiguredLineWebhookSecretProvider implements LineWebhookSecretProvider {
  getSecret(tenantId: string) {
    return getLineWebhookSecret(tenantId);
  }
}

export class EnvironmentWebhookPepperProvider implements WebhookPepperProvider {
  getPepper() {
    return envSchema.parse(process.env).SESSION_PEPPER;
  }
}
