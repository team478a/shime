import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import { auditLogs, checkinLogs, checkins, getDatabase, lovePassports } from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
const input = z.object({ reason: z.string().trim().min(1).max(1000) });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; participantId: string }> },
) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "checkin:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "REASON_REQUIRED" }, { status: 400 });
  const { eventId, participantId } = await params;
  const db = getDatabase();
  const now = new Date();
  const [cancelled] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(checkins)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: session.userId,
        cancellationReason: parsed.data.reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(checkins.tenantId, session.tenantId),
          eq(checkins.eventId, eventId),
          eq(checkins.participantId, participantId),
          eq(checkins.status, "checked_in"),
        ),
      )
      .returning();
    if (rows[0]) {
      await tx.insert(checkinLogs).values({
        tenantId: session.tenantId,
        eventId,
        participantId,
        checkinId: rows[0].id,
        action: "cancelled",
        method: rows[0].method,
        actorUserId: session.userId,
        reason: parsed.data.reason,
      });
      await tx
        .update(lovePassports)
        .set({ status: "ready", updatedAt: now })
        .where(
          and(
            eq(lovePassports.tenantId, session.tenantId),
            eq(lovePassports.eventId, eventId),
            eq(lovePassports.participantId, participantId),
          ),
        );
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        eventId,
        action: "checkin.cancel",
        targetType: "participant",
        targetId: participantId,
        reason: parsed.data.reason,
        requestId,
      });
    }
    return rows;
  });
  return cancelled
    ? NextResponse.json({ data: cancelled })
    : NextResponse.json({ code: "NOT_CHECKED_IN" }, { status: 409 });
}
