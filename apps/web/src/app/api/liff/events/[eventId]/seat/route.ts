import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { eventSeats, eventTables, getDatabase, seatAssignments, seatingRuns } from "@shime/db";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireParticipantForEvent(eventId).catch(() => null);
  if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
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
        eq(seatAssignments.tenantId, auth.session.tenantId),
        eq(seatAssignments.eventId, eventId),
        eq(seatAssignments.participantId, auth.participant.id),
        isNotNull(seatAssignments.publishedAt),
      ),
    )
    .limit(1);
  return NextResponse.json({ data: rows[0] ?? null });
}
