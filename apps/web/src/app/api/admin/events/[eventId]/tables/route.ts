import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  canonicalizeVenueLayoutTables,
  requirePermission,
  validateSeatConfiguration,
  VENUE_LAYOUT_MODULE_KEY,
  VENUE_LAYOUT_SCHEMA_VERSION,
  VENUE_LAYOUT_TEMPLATE_TYPE,
  venueLayoutApplicationInputSchema,
} from "@shime/core";
import {
  auditLogs,
  eventSeats,
  eventTables,
  events,
  getDatabase,
  resourceTemplateApplications,
  resourceTemplates,
  seatAssignments,
} from "@shime/db";
import { requireStaffSession } from "../../../../../../server/auth";

type Context = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const { eventId } = await context.params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const db = getDatabase();
  const tableRows = await db
    .select()
    .from(eventTables)
    .where(and(eq(eventTables.tenantId, session.tenantId), eq(eventTables.eventId, eventId)));
  const seatRows = await db
    .select()
    .from(eventSeats)
    .where(and(eq(eventSeats.tenantId, session.tenantId), eq(eventSeats.eventId, eventId)));
  return NextResponse.json({
    data: tableRows
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((table) => ({
        ...table,
        seats: seatRows
          .filter((seat) => seat.tableId === table.id)
          .map((seat) => ({ seatCode: seat.seatCode, enabled: seat.enabled })),
      })),
  });
}

export async function PUT(request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try {
    requirePermission(session.role, "event:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  }
  const { eventId } = await context.params;
  if (session.eventId && session.eventId !== eventId)
    return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const raw = await request.json().catch(() => null);
  const parsed = venueLayoutApplicationInputSchema.safeParse(Array.isArray(raw) ? { tables: raw } : raw);
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  const db = getDatabase();
  const eventRows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  const event = eventRows[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const assigned = await db
    .select({ id: seatAssignments.id })
    .from(seatAssignments)
    .where(and(eq(seatAssignments.tenantId, session.tenantId), eq(seatAssignments.eventId, eventId)))
    .limit(1);
  if (assigned[0])
    return NextResponse.json({ code: "SEAT_CONFIGURATION_IN_USE", request_id: requestId }, { status: 409 });
  let warning;
  try {
    warning = validateSeatConfiguration(parsed.data.tables, event.capacity);
  } catch (error) {
    return NextResponse.json(
      {
        code: "INVALID_SEAT_CONFIGURATION",
        message: error instanceof Error ? error.message : "Invalid configuration",
        request_id: requestId,
      },
      { status: 400 },
    );
  }
  const sourceTemplate = parsed.data.sourceTemplateId
    ? (
        await db
          .select()
          .from(resourceTemplates)
          .where(
            and(
              eq(resourceTemplates.id, parsed.data.sourceTemplateId),
              eq(resourceTemplates.tenantId, session.tenantId),
              eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
              eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (parsed.data.sourceTemplateId && !sourceTemplate)
    return NextResponse.json({ code: "SOURCE_TEMPLATE_NOT_FOUND", request_id: requestId }, { status: 404 });
  const snapshot = { schemaVersion: VENUE_LAYOUT_SCHEMA_VERSION, tables: parsed.data.tables };
  const snapshotHash = createHash("sha256").update(canonicalizeVenueLayoutTables(parsed.data.tables)).digest("hex");
  await db.transaction(async (tx) => {
    await tx.delete(eventSeats).where(and(eq(eventSeats.tenantId, session.tenantId), eq(eventSeats.eventId, eventId)));
    await tx
      .delete(eventTables)
      .where(and(eq(eventTables.tenantId, session.tenantId), eq(eventTables.eventId, eventId)));
    for (const table of parsed.data.tables) {
      const [created] = await tx
        .insert(eventTables)
        .values({
          tenantId: session.tenantId,
          eventId,
          tableCode: table.tableCode,
          capacity: table.capacity,
          displayOrder: table.displayOrder,
        })
        .returning();
      if (!created) throw new Error("Failed to create table");
      if (table.seats.length)
        await tx.insert(eventSeats).values(
          table.seats.map((seat) => ({
            tenantId: session.tenantId,
            eventId,
            tableId: created.id,
            seatCode: seat.seatCode,
          })),
        );
    }
    if (sourceTemplate)
      await tx.insert(resourceTemplateApplications).values({
        tenantId: session.tenantId,
        moduleKey: VENUE_LAYOUT_MODULE_KEY,
        templateType: VENUE_LAYOUT_TEMPLATE_TYPE,
        templateId: sourceTemplate.id,
        templateVersion: sourceTemplate.version,
        targetType: "event",
        targetId: eventId,
        appliedSnapshot: snapshot,
        snapshotHash,
        appliedBy: session.userId,
      });
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "event.tables.replace",
      targetType: "event",
      targetId: eventId,
      after: {
        tableCount: parsed.data.tables.length,
        sourceTemplateId: sourceTemplate?.id,
        sourceTemplateVersion: sourceTemplate?.version,
        snapshotHash,
      },
      requestId,
    });
  });
  return NextResponse.json({
    ok: true,
    warnings: warning.exceedsEventCapacity ? ["SEATS_EXCEED_EVENT_CAPACITY"] : [],
    request_id: requestId,
  });
}
