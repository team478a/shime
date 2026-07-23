import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { events, getDatabase } from "@shime/db";
import { getParticipantEventStatusLabel } from "@shime/web/lib/participant-event";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireParticipantForEvent(eventId).catch(() => null);
  if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const event = (
    await getDatabase()
      .select({
        name: events.name,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        venueName: events.venueName,
        venueAddress: events.venueAddress,
      })
      .from(events)
      .where(and(eq(events.tenantId, auth.session.tenantId), eq(events.id, eventId)))
      .limit(1)
  )[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const { status, ...eventData } = event;
  return NextResponse.json(
    { data: { ...eventData, statusLabel: getParticipantEventStatusLabel(status) } },
    { headers: { "cache-control": "private, no-store" } },
  );
}
