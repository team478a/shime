import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import {
  hasPermission,
  VENUE_LAYOUT_MODULE_KEY,
  VENUE_LAYOUT_TEMPLATE_TYPE,
  venueLayoutPayloadSchema,
} from "@shime/core";
import { eventSeats, eventTables, events, getDatabase, resourceTemplates } from "@shime/db";
import { notFound, redirect } from "next/navigation";

import type { TableLayoutSource } from "../../../../../lib/table-layout";
import { getStaffSession } from "../../../../../server/auth";
import { TableSettingsForm } from "./table-settings-form";

const codeCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

export default async function TablesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();

  const db = getDatabase();
  const event = (await db.select({ capacity: events.capacity, venueName: events.venueName }).from(events).where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId))).limit(1))[0];
  if (!event) notFound();
  const tables = await db.select().from(eventTables).where(and(eq(eventTables.tenantId, session.tenantId), eq(eventTables.eventId, eventId))).orderBy(asc(eventTables.displayOrder));
  const seats = await db.select().from(eventSeats).where(and(eq(eventSeats.tenantId, session.tenantId), eq(eventSeats.eventId, eventId)));

  const templateRows = await db.select().from(resourceTemplates).where(and(
    eq(resourceTemplates.tenantId, session.tenantId),
    eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
    eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
    eq(resourceTemplates.active, true),
  )).orderBy(desc(resourceTemplates.updatedAt));
  const templateSources: TableLayoutSource[] = templateRows.flatMap((template) => {
    const payload = venueLayoutPayloadSchema.safeParse(template.payload);
    if (!payload.success) return [];
    return [{
      id: `template:${template.id}`,
      kind: "template" as const,
      label: `${template.name}（v${template.version}）`,
      templateId: template.id,
      templateName: template.name,
      rows: payload.data.tables.sort((left, right) => left.displayOrder - right.displayOrder).map((table) => ({
        tableCode: table.tableCode,
        capacity: table.capacity,
        seats: table.seats.map((seat) => seat.seatCode).sort(codeCollator.compare).join(", "),
      })),
    }];
  });

  const priorEvents = session.eventId ? [] : await db.select({ id: events.id, name: events.name, venueName: events.venueName, startsAt: events.startsAt }).from(events).where(and(eq(events.tenantId, session.tenantId), ne(events.id, eventId))).orderBy(desc(events.startsAt)).limit(20);
  const priorEventIds = priorEvents.map((item) => item.id);
  const priorTables = priorEventIds.length ? await db.select().from(eventTables).where(and(eq(eventTables.tenantId, session.tenantId), inArray(eventTables.eventId, priorEventIds))).orderBy(asc(eventTables.displayOrder)) : [];
  const priorSeats = priorEventIds.length ? await db.select().from(eventSeats).where(and(eq(eventSeats.tenantId, session.tenantId), inArray(eventSeats.eventId, priorEventIds))) : [];
  const eventSources: TableLayoutSource[] = priorEvents.flatMap((sourceEvent) => {
    const sourceTables = priorTables.filter((table) => table.eventId === sourceEvent.id);
    if (!sourceTables.length) return [];
    const date = sourceEvent.startsAt.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
    const venue = sourceEvent.venueName ? `・${sourceEvent.venueName}` : "";
    return [{
      id: `event:${sourceEvent.id}`,
      kind: "event" as const,
      label: `${sourceEvent.name}（${date}${venue}）`,
      rows: sourceTables.map((table) => ({
        tableCode: table.tableCode,
        capacity: table.capacity,
        seats: priorSeats.filter((seat) => seat.eventId === sourceEvent.id && seat.tableId === table.id).map((seat) => seat.seatCode).sort(codeCollator.compare).join(", "),
      })),
    }];
  });

  return <main><TableSettingsForm
    eventId={eventId}
    eventCapacity={event.capacity}
    initial={tables.map((table) => ({
      tableCode: table.tableCode,
      capacity: table.capacity,
      seats: seats.filter((seat) => seat.tableId === table.id).map((seat) => seat.seatCode).sort(codeCollator.compare).join(", "),
    }))}
    layoutSources={[...templateSources, ...eventSources]}
    canCreateTemplate={!session.eventId}
    initialTemplateName={event.venueName ? `${event.venueName} レイアウト` : ""}
  /></main>;
}
