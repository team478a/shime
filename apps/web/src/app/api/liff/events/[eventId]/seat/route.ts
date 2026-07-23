import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { eventSeats, eventTables, getDatabase, seatAssignments, seatingRuns } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";
export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const rows = await getDatabase()
      .select({
        tableCode: eventTables.tableCode,
        seatCode: eventSeats.seatCode,
        explanation: seatAssignments.explanation,
        publishedAt: seatAssignments.publishedAt,
      })
      .from(seatAssignments)
      .innerJoin(
        seatingRuns,
        and(
          eq(seatingRuns.id, seatAssignments.seatingRunId),
          eq(seatingRuns.tenantId, seatAssignments.tenantId),
          eq(seatingRuns.status, "published"),
        ),
      )
      .innerJoin(
        eventSeats,
        and(
          eq(eventSeats.id, seatAssignments.seatId),
          eq(eventSeats.tenantId, seatAssignments.tenantId),
          eq(eventSeats.eventId, seatAssignments.eventId),
        ),
      )
      .innerJoin(
        eventTables,
        and(
          eq(eventTables.id, eventSeats.tableId),
          eq(eventTables.tenantId, seatAssignments.tenantId),
          eq(eventTables.eventId, seatAssignments.eventId),
        ),
      )
      .where(
        and(
          eq(seatAssignments.tenantId, session.tenantId),
          eq(seatAssignments.eventId, eventId),
          eq(seatAssignments.participantId, participant.id),
          isNotNull(seatAssignments.publishedAt),
        ),
      )
      .limit(1);
    return NextResponse.json({ data: rows[0] ?? null });
  },
);
