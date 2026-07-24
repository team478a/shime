import { verifyWebhookSignature } from "@shime/core";
import { createDrizzleLineWebhookRepository, ProcessLineWebhook, Sha256LineUserIdHasher } from "@shime/integrations";
import { ConfiguredLineWebhookSecretProvider, EnvironmentWebhookPepperProvider } from "./line-webhook-providers";

export const processLineWebhook = new ProcessLineWebhook(
  createDrizzleLineWebhookRepository(),
  new ConfiguredLineWebhookSecretProvider(),
  new EnvironmentWebhookPepperProvider(),
  verifyWebhookSignature,
  new Sha256LineUserIdHasher(),
);
