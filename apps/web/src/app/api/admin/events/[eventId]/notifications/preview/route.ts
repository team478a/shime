import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requirePermission } from "@shime/core";
import {
  checkins,
  getDatabase,
  matchCandidates,
  notificationTemplates,
  participants,
  resultConfirmations,
} from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "result:confirm");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const db = getDatabase();
  const confirmation = await db
    .select()
    .from(resultConfirmations)
    .where(
      and(
        eq(resultConfirmations.tenantId, session.tenantId),
        eq(resultConfirmations.eventId, eventId),
        isNull(resultConfirmations.revokedAt),
      ),
    )
    .limit(1);
  if (!confirmation[0]) return NextResponse.json({ code: "RESULT_NOT_CONFIRMED" }, { status: 409 });
  const recipients = await db
    .select({ id: participants.id })
    .from(participants)
    .innerJoin(
      checkins,
      and(
        eq(checkins.tenantId, participants.tenantId),
        eq(checkins.eventId, participants.eventId),
        eq(checkins.participantId, participants.id),
        eq(checkins.status, "checked_in"),
      ),
    )
    .where(
      and(
        eq(participants.tenantId, session.tenantId),
        eq(participants.eventId, eventId),
        isNotNull(participants.userId),
      ),
    );
  const approved = await db
    .select()
    .from(matchCandidates)
    .where(
      and(
        eq(matchCandidates.tenantId, session.tenantId),
        eq(matchCandidates.eventId, eventId),
        eq(matchCandidates.status, "approved"),
      ),
    );
  const templates = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.tenantId, session.tenantId),
        eq(notificationTemplates.active, true),
        inArray(notificationTemplates.templateKey, ["result_matched", "result_unmatched"]),
      ),
    )
    .orderBy(desc(notificationTemplates.version));
  const text = (key: string, fallback: string) => templates.find((item) => item.templateKey === key)?.body ?? fallback;
  const matchedIds = new Set(approved.flatMap((candidate) => [candidate.participantAId, candidate.participantBId]));
  return NextResponse.json({
    data: {
      targetCount: recipients.length,
      approvedCount: approved.length,
      matchedParticipantCount: recipients.filter((participant) => matchedIds.has(participant.id)).length,
      unmatchedParticipantCount: recipients.filter((participant) => !matchedIds.has(participant.id)).length,
      matchedText: text("result_matched", "結果をご確認ください。お互いの気持ちが重なりました。"),
      unmatchedText: text("result_unmatched", "結果をご確認ください。今回は成立となりませんでした。"),
      confirmationId: confirmation[0].id,
    },
  });
}
