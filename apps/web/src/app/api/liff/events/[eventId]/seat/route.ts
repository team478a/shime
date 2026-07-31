import { NextResponse } from "next/server";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getPublishedParticipantSeat } from "@shime/web/server/seating-use-cases";

export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const seat = await getPublishedParticipantSeat.execute({ tenantId: session.tenantId, eventId }, participant.id);
    return NextResponse.json({ data: seat });
  },
);
