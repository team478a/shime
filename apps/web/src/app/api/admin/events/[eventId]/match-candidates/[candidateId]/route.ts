import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import { auditLogs, events, getDatabase, matchCandidates } from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
const input = z.object({
  status: z.enum(["pending", "approved", "declined"]),
  reason: z.string().trim().max(1000).nullable().optional(),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; candidateId: string }> },
) {
  const { eventId, candidateId } = await params;
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "result:confirm");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const db = getDatabase();
  const eventRows = await db
    .select()
    .from(events)
    .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
    .limit(1);
  const event = eventRows[0];
  if (!event || event.status !== "preference_closed")
    return NextResponse.json({ code: "PREFERENCE_NOT_CLOSED" }, { status: 409 });
  const rows = await db
    .select()
    .from(matchCandidates)
    .where(
      and(
        eq(matchCandidates.tenantId, session.tenantId),
        eq(matchCandidates.eventId, eventId),
        eq(matchCandidates.id, candidateId),
      ),
    )
    .limit(1);
  const candidate = rows[0];
  if (!candidate) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  if (parsed.data.status === "approved" && !event.allowMultipleMatches) {
    const conflict = await db
      .select({ id: matchCandidates.id })
      .from(matchCandidates)
      .where(
        and(
          eq(matchCandidates.tenantId, session.tenantId),
          eq(matchCandidates.eventId, eventId),
          eq(matchCandidates.status, "approved"),
          or(
            eq(matchCandidates.participantAId, candidate.participantAId),
            eq(matchCandidates.participantBId, candidate.participantAId),
            eq(matchCandidates.participantAId, candidate.participantBId),
            eq(matchCandidates.participantBId, candidate.participantBId),
          ),
        ),
      )
      .limit(1);
    if (conflict[0] && conflict[0].id !== candidateId)
      return NextResponse.json({ code: "MULTIPLE_MATCH_CONFLICT" }, { status: 409 });
  }
  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const saved = await tx
      .update(matchCandidates)
      .set({
        status: parsed.data.status,
        decisionReason: parsed.data.reason ?? null,
        decidedBy: session.userId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(eq(matchCandidates.id, candidateId))
      .returning();
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "match_candidate.decide",
      targetType: "match_candidate",
      targetId: candidateId,
      before: { status: candidate.status },
      after: { status: parsed.data.status },
      reason: parsed.data.reason ?? undefined,
      requestId: randomUUID(),
    });
    return saved;
  });
  return NextResponse.json({ data: updated });
}
