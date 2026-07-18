import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase, lovePassports } from "@shime/db";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) { const { eventId } = await params; const auth = await requireParticipantForEvent(eventId).catch(() => null); if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }); const rows = await getDatabase().select().from(lovePassports).where(and(eq(lovePassports.tenantId, auth.session.tenantId), eq(lovePassports.eventId, eventId), eq(lovePassports.participantId, auth.participant.id))).limit(1); return rows[0] ? NextResponse.json({ data: { status: rows[0].status, participantNumber: auth.participant.participantNumber, qrExpiresAt: rows[0].qrExpiresAt } }) : NextResponse.json({ code: "NOT_ISSUED" }, { status: 404 }); }
