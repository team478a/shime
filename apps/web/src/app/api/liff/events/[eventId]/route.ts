import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { events, getDatabase } from "@shime/db";
import { getParticipantEventStatusLabel } from "@shime/web/lib/participant-event";
import { participantHandler } from "@shime/web/server/api/participant-handler";

export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, session }) => {
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
        .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
        .limit(1)
    )[0];
    if (!event) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    const { status, ...eventData } = event;
    return NextResponse.json(
      { data: { ...eventData, statusLabel: getParticipantEventStatusLabel(status) } },
      { headers: { "cache-control": "private, no-store" } },
    );
  },
);
