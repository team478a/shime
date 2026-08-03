import { and, asc, eq } from "drizzle-orm";
import { auditLogs, events, getDatabase, tenantServiceSettings } from "@shime/db";
import type { LineRichMenuRepository } from "./line-rich-menu-repository";
import { lineServiceConfigSchema } from "./line-rich-menu-types";

export function createDrizzleLineRichMenuRepository(): LineRichMenuRepository {
  return {
    listEvents(tenantId) {
      return getDatabase()
        .select({ id: events.id, name: events.name, status: events.status, startsAt: events.startsAt })
        .from(events)
        .where(eq(events.tenantId, tenantId))
        .orderBy(asc(events.startsAt));
    },

    async findEvent(tenantId, eventId) {
      return (
        (
          await getDatabase()
            .select({ id: events.id, name: events.name, status: events.status, startsAt: events.startsAt })
            .from(events)
            .where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)))
            .limit(1)
        )[0] ?? null
      );
    },

    async getLineSettings(tenantId) {
      const row = (
        await getDatabase()
          .select({ enabled: tenantServiceSettings.enabled, config: tenantServiceSettings.config })
          .from(tenantServiceSettings)
          .where(and(eq(tenantServiceSettings.tenantId, tenantId), eq(tenantServiceSettings.serviceKey, "line")))
          .limit(1)
      )[0];
      if (!row) return null;
      return { enabled: row.enabled, config: lineServiceConfigSchema.parse(row.config) };
    },

    async saveDeployment(input) {
      const db = getDatabase();
      await db.transaction(async (tx) => {
        const row = (
          await tx
            .select({ config: tenantServiceSettings.config })
            .from(tenantServiceSettings)
            .where(
              and(eq(tenantServiceSettings.tenantId, input.tenantId), eq(tenantServiceSettings.serviceKey, "line")),
            )
            .limit(1)
        )[0];
        if (!row) throw new Error("LINE_SETTINGS_NOT_FOUND");
        const config = lineServiceConfigSchema.parse(row.config);
        const persistedPrevious = config.richMenu.current;
        const history = persistedPrevious
          ? [
              persistedPrevious,
              ...config.richMenu.history.filter((item) => item.richMenuId !== persistedPrevious.richMenuId),
            ].slice(0, 10)
          : config.richMenu.history;
        await tx
          .update(tenantServiceSettings)
          .set({
            config: { ...config, richMenu: { current: input.deployment, history } },
            updatedBy: input.actorUserId,
            updatedAt: new Date(input.deployment.appliedAt),
          })
          .where(and(eq(tenantServiceSettings.tenantId, input.tenantId), eq(tenantServiceSettings.serviceKey, "line")));
        await tx.insert(auditLogs).values({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          eventId: input.deployment.eventId,
          action: "platform.line.rich_menu.publish",
          targetType: "event",
          targetId: input.deployment.eventId,
          before: persistedPrevious
            ? { richMenuId: persistedPrevious.richMenuId, eventId: persistedPrevious.eventId }
            : null,
          after: { richMenuId: input.deployment.richMenuId, eventId: input.deployment.eventId },
          requestId: input.requestId,
        });
      });
    },
  };
}
