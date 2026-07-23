import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase, lovePassports } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";
export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const rows = await getDatabase()
      .select()
      .from(lovePassports)
      .where(
        and(
          eq(lovePassports.tenantId, session.tenantId),
          eq(lovePassports.eventId, eventId),
          eq(lovePassports.participantId, participant.id),
        ),
      )
      .limit(1);
    return rows[0]
      ? NextResponse.json({
          data: {
            status: rows[0].status,
            participantNumber: participant.participantNumber,
            qrExpiresAt: rows[0].qrExpiresAt,
          },
        })
      : NextResponse.json({ code: "NOT_ISSUED" }, { status: 404 });
  },
);
