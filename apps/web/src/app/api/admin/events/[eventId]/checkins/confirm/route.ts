import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import { auditLogs, checkinLogs, checkins, getDatabase, lovePassports, participants } from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
const input = z.object({ participantId: z.string().uuid(), method: z.enum(["qr", "manual"]) });
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "checkin:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const { eventId } = await params;
  const db = getDatabase();
  const target = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.id, parsed.data.participantId),
        eq(participants.tenantId, session.tenantId),
        eq(participants.eventId, eventId),
      ),
    )
    .limit(1);
  if (!target[0]) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const existing = await db
    .select()
    .from(checkins)
    .where(
      and(
        eq(checkins.tenantId, session.tenantId),
        eq(checkins.eventId, eventId),
        eq(checkins.participantId, parsed.data.participantId),
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
            method: parsed.data.method,
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
            participantId: parsed.data.participantId,
            status: "checked_in",
            checkedInAt: now,
            checkedInBy: session.userId,
            method: parsed.data.method,
          })
          .returning();
    if (!rows[0]) throw new Error("CHECKIN_FAILED");
    await tx.insert(checkinLogs).values({
      tenantId: session.tenantId,
      eventId,
      participantId: parsed.data.participantId,
      checkinId: rows[0].id,
      action: "confirmed",
      method: parsed.data.method,
      actorUserId: session.userId,
    });
    await tx
      .update(lovePassports)
      .set({ status: "checked_in", updatedAt: now })
      .where(
        and(
          eq(lovePassports.tenantId, session.tenantId),
          eq(lovePassports.eventId, eventId),
          eq(lovePassports.participantId, parsed.data.participantId),
        ),
      );
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "checkin.confirm",
      targetType: "participant",
      targetId: parsed.data.participantId,
      after: { method: parsed.data.method },
      requestId,
    });
    return rows;
  });
  return NextResponse.json({ data: saved });
}
