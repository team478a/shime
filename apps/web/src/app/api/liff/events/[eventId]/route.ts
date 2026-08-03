import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { events, getDatabase } from "@shime/db";
import { getEventSeatingMode } from "@shime/core";
import { getParticipantEventStatusLabel } from "@shime/web/lib/participant-event";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getParticipantJourneySettings } from "@shime/web/server/event-journey-use-cases";

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
          settings: events.settings,
        })
        .from(events)
        .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
        .limit(1)
    )[0];
    if (!event) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    const journey = await getParticipantJourneySettings.execute({
      tenantId: session.tenantId,
      eventId,
    });
    const { status, settings, ...eventData } = event;
    const seatingMode = getEventSeatingMode(settings);
    return NextResponse.json(
      {
        data: {
          ...eventData,
          statusLabel: getParticipantEventStatusLabel(status),
          participantJourney: (journey?.effectiveSteps ?? []).filter(
            (step) => seatingMode === "assigned" || step.id !== "questionnaire",
          ),
          seatingMode,
        },
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  },
);
