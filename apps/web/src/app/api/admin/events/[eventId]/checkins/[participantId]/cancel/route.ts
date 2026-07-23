import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLogs, checkinLogs, checkins, getDatabase, lovePassports } from "@shime/db";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
const input = z.object({ reason: z.string().trim().min(1).max(1000) });
export const POST = staffEventHandler(
  { permission: "checkin:write", includeRequestIdInErrors: false },
  async (_request: Request, { params }: { params: Promise<{ eventId: string; participantId: string }> }) =>
    (await params).eventId,
  async (
    { eventId, requestId, session },
    request: Request,
    { params }: { params: Promise<{ eventId: string; participantId: string }> },
  ) => {
    const data = await parseJsonBody(request, input, "REASON_REQUIRED");
    const { participantId } = await params;
    const db = getDatabase();
    const now = new Date();
    const [cancelled] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(checkins)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: session.userId,
          cancellationReason: data.reason,
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
          reason: data.reason,
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
          reason: data.reason,
          requestId,
        });
      }
      return rows;
    });
    return cancelled
      ? NextResponse.json({ data: cancelled })
      : NextResponse.json({ code: "NOT_CHECKED_IN" }, { status: 409 });
  },
);
