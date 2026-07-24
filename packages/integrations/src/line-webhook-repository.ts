import type { StoredLineWebhookEvent } from "./line-webhook-types";

export interface LineWebhookRepository {
  findTenantIdByCode(tenantCode: string): Promise<string | null>;
  storeIfNew(tenantId: string, events: StoredLineWebhookEvent[]): Promise<void>;
}

export interface LineWebhookSecretProvider {
  getSecret(tenantId: string): Promise<string>;
}

export interface WebhookPepperProvider {
  getPepper(): string;
}

export interface LineUserIdHasher {
  hash(lineUserId: string, pepper: string): string;
}

export type LineWebhookSignatureVerifier = (
  rawBody: string,
  signature: string | null,
  channelSecret: string,
) => boolean;
