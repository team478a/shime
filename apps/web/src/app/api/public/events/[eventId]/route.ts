import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { eventFormFields, events, getDatabase } from "@shime/db";

type Context = { params: Promise<{ eventId: string }> };
export async function GET(_request: Request, context: Context) {
  const { eventId } = await context.params; const db = getDatabase();
  const eventRows = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.status, "accepting"))).limit(1); const event = eventRows[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const fields = await db.select().from(eventFormFields).where(and(eq(eventFormFields.tenantId, event.tenantId), eq(eventFormFields.eventId, event.id)));
  return NextResponse.json({ data: { id: event.id, name: event.name, startsAt: event.startsAt, venueName: event.venueName, venueAddress: event.venueAddress, fields: fields.sort((a, b) => a.displayOrder - b.displayOrder) } });
}
