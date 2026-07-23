import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLogs, checkinLogs, checkins, getDatabase, lovePassports, participants } from "@shime/db";
import { BusinessRuleError } from "@shime/web/server/api/errors";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
const input = z.object({ participantId: z.string().uuid(), method: z.enum(["qr", "manual"]) });
export const POST = staffEventHandler(
  { permission: "checkin:write", includeRequestIdInErrors: false },
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, requestId, session }, request: Request) => {
    const data = await parseJsonBody(request, input);
    const db = getDatabase();
    const target = await db
      .select({ id: participants.id })
      .from(participants)
      .where(
        and(
          eq(participants.id, data.participantId),
          eq(participants.tenantId, session.tenantId),
          eq(participants.eventId, eventId),
        ),
      )
      .limit(1);
    if (!target[0]) throw new BusinessRuleError("NOT_FOUND", 404);
    const existing = await db
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.tenantId, session.tenantId),
          eq(checkins.eventId, eventId),
          eq(checkins.participantId, data.participantId),
        ),
      )
      .limit(1);
    if (existing[0]?.status === "checked_in")
      return NextResponse.json(
        { code: "ALREADY_CHECKED_IN", data: { checkedInAt: existing[0].checkedInAt } },
        { status: 409 },
      );
    const now = new Date();
    const [saved] = await db.transaction(async (tx) => {
      const rows = existing[0]
        ? await tx
            .update(checkins)
            .set({
              status: "checked_in",
              checkedInAt: now,
              checkedInBy: session.userId,
              method: data.method,
              cancelledAt: null,
              cancelledBy: null,
              cancellationReason: null,
              updatedAt: now,
            })
            .where(eq(checkins.id, existing[0].id))
            .returning()
        : await tx
            .insert(checkins)
            .values({
              tenantId: session.tenantId,
              eventId,
              participantId: data.participantId,
              status: "checked_in",
              checkedInAt: now,
              checkedInBy: session.userId,
              method: data.method,
            })
            .returning();
      if (!rows[0]) throw new Error("CHECKIN_FAILED");
      await tx.insert(checkinLogs).values({
        tenantId: session.tenantId,
        eventId,
        participantId: data.participantId,
        checkinId: rows[0].id,
        action: "confirmed",
        method: data.method,
        actorUserId: session.userId,
      });
      await tx
        .update(lovePassports)
        .set({ status: "checked_in", updatedAt: now })
        .where(
          and(
            eq(lovePassports.tenantId, session.tenantId),
            eq(lovePassports.eventId, eventId),
            eq(lovePassports.participantId, data.participantId),
          ),
        );
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        eventId,
        action: "checkin.confirm",
        targetType: "participant",
        targetId: data.participantId,
        after: { method: data.method },
        requestId,
      });
      return rows;
    });
    return NextResponse.json({ data: saved });
  },
);
