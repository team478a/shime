import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { applications, events, getDatabase, matchCandidates, participants, resultConfirmations } from "@shime/db";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireParticipantForEvent(eventId).catch(() => null);
  if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const db = getDatabase();
  const event = await db
    .select()
    .from(events)
    .where(
      and(eq(events.tenantId, auth.session.tenantId), eq(events.id, eventId), eq(events.status, "result_confirmed")),
    )
    .limit(1);
  if (!event[0] || !event[0].resultPublishAt || event[0].resultPublishAt > new Date())
    return NextResponse.json({ data: { available: false } });
  const confirmation = await db
    .select()
    .from(resultConfirmations)
    .where(
      and(
        eq(resultConfirmations.tenantId, auth.session.tenantId),
        eq(resultConfirmations.eventId, eventId),
        isNull(resultConfirmations.revokedAt),
      ),
    )
    .limit(1);
  if (!confirmation[0]) return NextResponse.json({ data: { available: false } });
  const approved = await db
    .select()
    .from(matchCandidates)
    .where(
      and(
        eq(matchCandidates.tenantId, auth.session.tenantId),
        eq(matchCandidates.eventId, eventId),
        eq(matchCandidates.status, "approved"),
        or(
          eq(matchCandidates.participantAId, auth.participant.id),
          eq(matchCandidates.participantBId, auth.participant.id),
        ),
      ),
    );
  const matches = [];
  for (const candidate of approved) {
    const partnerId =
      candidate.participantAId === auth.participant.id ? candidate.participantBId : candidate.participantAId;
    const rows = await db
      .select({ participantNumber: participants.participantNumber, nickname: applications.nickname })
      .from(participants)
      .innerJoin(
        applications,
        and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId)),
      )
      .where(
        and(
          eq(participants.tenantId, auth.session.tenantId),
          eq(participants.eventId, eventId),
          eq(participants.id, partnerId),
        ),
      )
      .limit(1);
    if (rows[0]) matches.push(rows[0]);
  }
  return NextResponse.json({
    data: { available: true, matched: matches.length > 0, matches, contactExchangeMode: "operator_mediated" },
  });
}
