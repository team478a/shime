import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { matchesCheckinSearch, normalizeCheckinSearchQuery } from "@shime/core";
import { applications, checkins, getDatabase, participants } from "@shime/db";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";

const input = z.object({
  query: z.string().trim().min(1).max(160).transform(normalizeCheckinSearchQuery),
});

export const POST = staffEventHandler(
  { permission: "checkin:write", includeRequestIdInErrors: false },
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, session }, request: Request) => {
    const { query } = await parseJsonBody(request, input);
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
  },
);
