import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { matchesCheckinSearch, normalizeCheckinSearchQuery, requirePermission } from "@shime/core";
import { applications, checkins, getDatabase, participants } from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";

const input = z.object({
  query: z.string().trim().min(1).max(160).transform(normalizeCheckinSearchQuery),
});

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
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
  const query = parsed.data.query;
  const rows = await getDatabase()
    .select({
      participantId: participants.id,
      participantNumber: participants.participantNumber,
      participantStatus: participants.status,
      fullName: applications.fullName,
      checkinStatus: checkins.status,
      checkedInAt: checkins.checkedInAt,
    })
    .from(participants)
    .innerJoin(
      applications,
      and(
        eq(applications.id, participants.applicationId),
        eq(applications.tenantId, participants.tenantId),
        eq(applications.eventId, participants.eventId),
      ),
    )
    .leftJoin(
      checkins,
      and(
        eq(checkins.tenantId, participants.tenantId),
        eq(checkins.eventId, participants.eventId),
        eq(checkins.participantId, participants.id),
      ),
    )
    .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)))
    .orderBy(asc(participants.participantNumber), asc(applications.fullName))
    .limit(1_000);
  const candidates = rows.filter((row) => matchesCheckinSearch(row, query)).slice(0, 20);

  return NextResponse.json({
    data: {
      candidates: candidates.map((row) => ({
        participantId: row.participantId,
        participantNumber: row.participantNumber ?? "未採番",
        fullName: row.fullName,
        participantStatus: row.participantStatus,
        alreadyCheckedIn: row.checkinStatus === "checked_in",
        checkedInAt: row.checkedInAt,
      })),
    },
  });
}
