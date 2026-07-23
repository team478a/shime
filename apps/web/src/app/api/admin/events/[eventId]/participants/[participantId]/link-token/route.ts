import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { canReissueLinkToken, createOpaqueToken, LINK_TOKEN_TTL_MS, requirePermission } from "@shime/core";
import { auditLogs, getDatabase, participants } from "@shime/db";
import { getEnv } from "@shime/web/env";
import { requireStaffSession } from "@shime/web/server/auth";

type Context = { params: Promise<{ eventId: string; participantId: string }> };

export async function POST(_request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try {
    requirePermission(session.role, "event:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  }
  const { eventId, participantId } = await context.params;
  if (session.eventId && session.eventId !== eventId)
    return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });

  const db = getDatabase();
  const participant = (
    await db
      .select({ id: participants.id, userId: participants.userId })
      .from(participants)
      .where(
        and(
          eq(participants.id, participantId),
          eq(participants.tenantId, session.tenantId),
          eq(participants.eventId, eventId),
        ),
      )
      .limit(1)
  )[0];
  if (!participant) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  if (!canReissueLinkToken(participant.userId))
    return NextResponse.json({ code: "ALREADY_LINKED", request_id: requestId }, { status: 409 });

  const token = createOpaqueToken(getEnv().LINK_TOKEN_PEPPER);
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(participants)
      .set({
        linkTokenHash: token.tokenHash,
        linkTokenExpiresAt: expiresAt,
        linkTokenUsedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(participants.id, participantId),
          eq(participants.tenantId, session.tenantId),
          eq(participants.eventId, eventId),
          isNull(participants.userId),
        ),
      )
      .returning({ id: participants.id });
    if (!rows[0]) return false;
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "participant.link_token.reissue",
      targetType: "participant",
      targetId: participantId,
      after: { expiresAt: expiresAt.toISOString() },
      requestId,
    });
    return true;
  });
  if (!updated) return NextResponse.json({ code: "ALREADY_LINKED", request_id: requestId }, { status: 409 });
  const response = NextResponse.json({ data: { linkToken: token.token, expiresAt }, request_id: requestId });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
