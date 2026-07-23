import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import {
  auditLogs,
  checkins,
  getDatabase,
  matchCandidates,
  notifications,
  notificationTemplates,
  participants,
  resultConfirmations,
} from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";

const input = z.object({
  expectedTargetCount: z.number().int().nonnegative(),
  expectedApprovedCount: z.number().int().nonnegative(),
});
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "result:confirm");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_CONFIRMATION_COUNTS" }, { status: 400 });
  const db = getDatabase();
  const confirmation = (
    await db
      .select()
      .from(resultConfirmations)
      .where(
        and(
          eq(resultConfirmations.tenantId, session.tenantId),
          eq(resultConfirmations.eventId, eventId),
          isNull(resultConfirmations.revokedAt),
        ),
      )
      .limit(1)
  )[0];
  if (!confirmation) return NextResponse.json({ code: "RESULT_NOT_CONFIRMED" }, { status: 409 });
  const recipients = await db
    .select({ id: participants.id, userId: participants.userId })
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
  if (recipients.length !== parsed.data.expectedTargetCount || approved.length !== parsed.data.expectedApprovedCount)
    return NextResponse.json(
      { code: "COUNTS_CHANGED", data: { targetCount: recipients.length, approvedCount: approved.length } },
      { status: 409 },
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
  const matched = new Set(approved.flatMap((candidate) => [candidate.participantAId, candidate.participantBId]));
  const now = new Date();
  const queued = await db.transaction(async (tx) => {
    const rows = recipients.length
      ? await tx
          .insert(notifications)
          .values(
            recipients.map((recipient) => ({
              tenantId: session.tenantId,
              eventId,
              userId: recipient.userId!,
              type: "result_available",
              dedupeKey: `result:${confirmation.id}:${recipient.id}`,
              scheduledAt: now,
              payload: {
                text: matched.has(recipient.id)
                  ? text("result_matched", "結果をご確認ください。お互いの気持ちが重なりました。")
                  : text("result_unmatched", "結果をご確認ください。今回は成立となりませんでした。"),
              },
            })),
          )
          .onConflictDoNothing()
          .returning()
      : [];
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "results.notifications.queue",
      targetType: "result_confirmation",
      targetId: confirmation.id,
      after: { targetCount: recipients.length, approvedCount: approved.length, queuedCount: rows.length },
      requestId: randomUUID(),
    });
    return rows;
  });
  return NextResponse.json({ data: { queuedCount: queued.length, targetCount: recipients.length } });
}
