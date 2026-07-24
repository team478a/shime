import { eq } from "drizzle-orm";
import { getDatabase, lineWebhookEvents, tenants } from "@shime/db";
import type { LineWebhookRepository } from "./line-webhook-repository";

export function createDrizzleLineWebhookRepository(): LineWebhookRepository {
  return {
    async findTenantIdByCode(tenantCode) {
      return (
        (await getDatabase().select({ id: tenants.id }).from(tenants).where(eq(tenants.code, tenantCode)).limit(1))[0]
          ?.id ?? null
      );
    },

    async storeIfNew(tenantId, events) {
      for (const event of events) {
        await getDatabase()
          .insert(lineWebhookEvents)
          .values({
            tenantId,
            ...event,
            status: "processed",
          })
          .onConflictDoNothing();
      }
    },
  };
}
