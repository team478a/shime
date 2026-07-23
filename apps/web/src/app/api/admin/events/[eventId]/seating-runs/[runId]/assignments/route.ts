import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import {
  applications,
  auditLogs,
  checkins,
  eventSeats,
  getDatabase,
  participantAvoidances,
  participants,
  seatAssignments,
  seatingRuns,
} from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
const body = z.object({
  assignments: z.array(
    z.object({ participantId: z.string().uuid(), seatId: z.string().uuid().nullable(), locked: z.boolean() }),
  ),
});
export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string; runId: string }> }) {
  const { eventId, runId } = await params;
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "seating:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const seatIds = parsed.data.assignments.flatMap((a) => (a.seatId ? [a.seatId] : []));
  if (new Set(seatIds).size !== seatIds.length) return NextResponse.json({ code: "DUPLICATE_SEAT" }, { status: 409 });
  const db = getDatabase();
  const run = await db
    .select()
    .from(seatingRuns)
    .where(
      and(
        eq(seatingRuns.id, runId),
        eq(seatingRuns.eventId, eventId),
        eq(seatingRuns.tenantId, session.tenantId),
        eq(seatingRuns.status, "draft"),
      ),
    )
    .limit(1);
  if (!run[0]) return NextResponse.json({ code: "RUN_NOT_EDITABLE" }, { status: 409 });
  const validPeople = await db
    .select({ id: participants.id, category: applications.participantCategory })
    .from(participants)
    .innerJoin(
      applications,
      and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId)),
    )
    .innerJoin(
      checkins,
      and(
        eq(checkins.tenantId, participants.tenantId),
        eq(checkins.eventId, participants.eventId),
        eq(checkins.participantId, participants.id),
        eq(checkins.status, "checked_in"),
      ),
    )
    .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)));
  const validSeats = await db
    .select({ id: eventSeats.id, tableId: eventSeats.tableId })
    .from(eventSeats)
    .where(
      and(eq(eventSeats.tenantId, session.tenantId), eq(eventSeats.eventId, eventId), eq(eventSeats.enabled, true)),
    );
  const peopleSet = new Set(validPeople.map((x) => x.id)),
    seatSet = new Set(validSeats.map((x) => x.id));
  if (parsed.data.assignments.some((a) => !peopleSet.has(a.participantId) || (a.seatId && !seatSet.has(a.seatId))))
    return NextResponse.json({ code: "CROSS_EVENT_REFERENCE" }, { status: 400 });
  const category = new Map(validPeople.map((p) => [p.id, p.category])),
    seatTable = new Map(validSeats.map((s) => [s.id, s.tableId]));
  const allowed = new Set(
    ((run[0].configSnapshot.allowedCategoryPairs as string[][] | undefined) ?? []).map((pair) =>
      [...pair].sort().join(":"),
    ),
  );
  const avoidedRows = await db
    .select()
    .from(participantAvoidances)
    .where(and(eq(participantAvoidances.tenantId, session.tenantId), eq(participantAvoidances.eventId, eventId)));
  const blocked = new Set(avoidedRows.map((a) => [a.participantId, a.avoidedParticipantId].sort().join(":")));
  const byTable = new Map<string, string[]>();
  for (const assignment of parsed.data.assignments)
    if (assignment.seatId) {
      const tableId = seatTable.get(assignment.seatId)!;
      byTable.set(tableId, [...(byTable.get(tableId) ?? []), assignment.participantId]);
    }
  for (const occupants of byTable.values()) {
    for (let i = 0; i < occupants.length; i++)
      for (let j = i + 1; j < occupants.length; j++)
        if (blocked.has([occupants[i]!, occupants[j]!].sort().join(":")))
          return NextResponse.json({ code: "AVOIDANCE_CONFLICT" }, { status: 409 });
    if (
      occupants.some(
        (a) => !occupants.some((b) => a !== b && allowed.has([category.get(a)!, category.get(b)!].sort().join(":"))),
      )
    )
      return NextResponse.json({ code: "CATEGORY_PAIR_CONFLICT" }, { status: 409 });
  }
  await db.transaction(async (tx) => {
    for (const a of parsed.data.assignments)
      await tx
        .update(seatAssignments)
        .set({ seatId: a.seatId, locked: a.locked, updatedAt: new Date() })
        .where(
          and(
            eq(seatAssignments.tenantId, session.tenantId),
            eq(seatAssignments.eventId, eventId),
            eq(seatAssignments.seatingRunId, runId),
            eq(seatAssignments.participantId, a.participantId),
          ),
        );
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "seating.assignments.update",
      targetType: "seating_run",
      targetId: runId,
      after: { changedCount: parsed.data.assignments.length },
      requestId: randomUUID(),
    });
  });
  return NextResponse.json({ data: { updated: parsed.data.assignments.length } });
}
