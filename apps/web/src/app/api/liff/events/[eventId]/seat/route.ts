import { NextResponse } from "next/server";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getPublishedParticipantSeat } from "@shime/web/server/seating-use-cases";
import { getEventSeatingModeForScope } from "@shime/web/server/event-settings";

export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const seatingMode = await getEventSeatingModeForScope(session.tenantId, eventId);
    if (seatingMode !== "assigned") return NextResponse.json({ data: null });
    const seat = await getPublishedParticipantSeat.execute({ tenantId: session.tenantId, eventId }, participant.id);
    return NextResponse.json({ data: seat });
  },
);
