import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashSessionToken, parseQrPayload } from "@shime/core";
import { applications, checkins, getDatabase, lovePassports, participants } from "@shime/db";
import { getEnv } from "@shime/web/env";
import { ValidationError } from "@shime/web/server/api/errors";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
const input = z.object({ qrToken: z.string().min(32).max(207) });
export const POST = staffEventHandler(
  { permission: "checkin:write", includeRequestIdInErrors: false },
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, session }, request: Request) => {
    const data = await parseJsonBody(request, input, "INVALID_QR");
    let qrToken;
    try {
      qrToken = parseQrPayload(data.qrToken);
    } catch {
      throw new ValidationError("INVALID_QR");
    }
    const db = getDatabase();
    const rows = await db
      .select({
        participantId: participants.id,
        participantNumber: participants.participantNumber,
        participantStatus: participants.status,
        fullName: applications.fullName,
        passportStatus: lovePassports.status,
      })
      .from(lovePassports)
      .innerJoin(
        participants,
        and(eq(participants.id, lovePassports.participantId), eq(participants.tenantId, lovePassports.tenantId)),
      )
      .innerJoin(
        applications,
        and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId)),
      )
      .where(
        and(
          eq(lovePassports.tenantId, session.tenantId),
          eq(lovePassports.eventId, eventId),
          eq(lovePassports.qrTokenHash, hashSessionToken(qrToken, getEnv().QR_TOKEN_PEPPER)),
          gt(lovePassports.qrExpiresAt, new Date()),
        ),
      )
      .limit(1);
    const target = rows[0];
    if (!target) return NextResponse.json({ code: "INVALID_OR_EXPIRED_QR" }, { status: 404 });
    const existing = await db
      .select({ status: checkins.status, checkedInAt: checkins.checkedInAt })
      .from(checkins)
      .where(
        and(
          eq(checkins.tenantId, session.tenantId),
          eq(checkins.eventId, eventId),
          eq(checkins.participantId, target.participantId),
        ),
      )
      .limit(1);
    return NextResponse.json({
      data: {
        ...target,
        alreadyCheckedIn: existing[0]?.status === "checked_in",
        checkedInAt: existing[0]?.checkedInAt,
      },
    });
  },
);
