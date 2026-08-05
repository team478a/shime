import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkins, getDatabase, lovePassports } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { loadPassportPreparation } from "@shime/web/server/passport-preparation";
export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const [rows, preparation] = await Promise.all([
      getDatabase()
        .select({
          status: lovePassports.status,
          qrExpiresAt: lovePassports.qrExpiresAt,
          receptionCategoryLabel: checkins.receptionCategoryLabel,
          receptionNumber: checkins.receptionNumber,
        })
        .from(lovePassports)
        .leftJoin(
          checkins,
          and(
            eq(checkins.tenantId, lovePassports.tenantId),
            eq(checkins.eventId, lovePassports.eventId),
            eq(checkins.participantId, lovePassports.participantId),
          ),
        )
        .where(
          and(
            eq(lovePassports.tenantId, session.tenantId),
            eq(lovePassports.eventId, eventId),
            eq(lovePassports.participantId, participant.id),
          ),
        )
        .limit(1),
      loadPassportPreparation({
        tenantId: session.tenantId,
        eventId,
        participantId: participant.id,
        dreamState: participant.dreamState,
      }),
    ]);
    return rows[0]
      ? NextResponse.json({
          data: {
            status: rows[0].status,
            participantNumber: participant.participantNumber,
            qrExpiresAt: rows[0].qrExpiresAt,
            receptionCategoryLabel: rows[0].receptionCategoryLabel,
            receptionNumber: rows[0].receptionNumber,
            preparation,
          },
        })
      : NextResponse.json({ code: "NOT_ISSUED" }, { status: 404 });
  },
);
