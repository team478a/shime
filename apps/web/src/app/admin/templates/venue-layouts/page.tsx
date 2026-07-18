import { and, desc, eq, inArray } from "drizzle-orm";
import { hasPermission, VENUE_LAYOUT_MODULE_KEY, VENUE_LAYOUT_TEMPLATE_TYPE, venueLayoutPayloadSchema } from "@shime/core";
import { events, getDatabase, resourceTemplateApplications, resourceTemplates } from "@shime/db";
import { redirect } from "next/navigation";

import { getStaffSession } from "../../../../server/auth";
import { VenueLayoutTemplateManager, type VenueLayoutTemplateGroup } from "./venue-layout-template-manager";

function formatDate(value: Date) {
  return value.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function VenueLayoutTemplatesPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write") || session.eventId) redirect("/admin");
  const db = getDatabase();
  const templates = await db.select().from(resourceTemplates).where(and(
    eq(resourceTemplates.tenantId, session.tenantId),
    eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
    eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
  )).orderBy(desc(resourceTemplates.version));
  const templateIds = templates.map((template) => template.id);
  const applications = templateIds.length ? await db.select().from(resourceTemplateApplications).where(and(
    eq(resourceTemplateApplications.tenantId, session.tenantId),
    eq(resourceTemplateApplications.moduleKey, VENUE_LAYOUT_MODULE_KEY),
    eq(resourceTemplateApplications.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
    inArray(resourceTemplateApplications.templateId, templateIds),
  )).orderBy(desc(resourceTemplateApplications.appliedAt)) : [];
  const eventIds = [...new Set(applications.filter((item) => item.targetType === "event").map((item) => item.targetId))];
  const eventRows = eventIds.length ? await db.select({ id: events.id, name: events.name }).from(events).where(and(eq(events.tenantId, session.tenantId), inArray(events.id, eventIds))) : [];
  const eventNames = new Map(eventRows.map((event) => [event.id, event.name]));
  const grouped = new Map<string, VenueLayoutTemplateGroup>();

  for (const template of templates) {
    const payload = venueLayoutPayloadSchema.safeParse(template.payload);
    if (!payload.success) continue;
    const uses = applications.filter((item) => item.templateId === template.id);
    const lastUse = uses[0];
    const version = {
      id: template.id,
      version: template.version,
      active: template.active,
      tableCount: payload.data.tables.length,
      seatCount: payload.data.tables.reduce((total, table) => total + table.seats.length, 0),
      createdAt: formatDate(template.createdAt),
      usageCount: uses.length,
      ...(lastUse ? { lastUsed: { eventName: eventNames.get(lastUse.targetId) ?? "削除済みイベント", appliedAt: formatDate(lastUse.appliedAt) } } : {}),
      preview: [...payload.data.tables].sort((left, right) => left.displayOrder - right.displayOrder).map((table) => ({ tableCode: table.tableCode, seatCodes: table.seats.map((seat) => seat.seatCode) })),
    };
    const current = grouped.get(template.templateKey);
    if (current) grouped.set(template.templateKey, { ...current, versions: [...current.versions, version] });
    else grouped.set(template.templateKey, { key: template.templateKey, name: template.name, versions: [version] });
  }
  return <main><VenueLayoutTemplateManager groups={[...grouped.values()]} /></main>;
}
