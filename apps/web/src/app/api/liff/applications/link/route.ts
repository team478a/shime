import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashSessionToken, verifyLastFour } from "@shime/core";
import { applications, auditLogs, getDatabase, participants } from "@shime/db";
import { getEnv } from "@shime/web/env";
import { requireParticipantSession } from "@shime/web/server/participant-auth";

const input = z
  .object({
    eventId: z.string().uuid(),
    linkToken: z.string().min(32).max(200),
    phoneLastFour: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((value) => value.phoneLastFour || value.birthDate, "Auxiliary verification is required");
export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireParticipantSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const db = getDatabase();
  const rows = await db
    .select({
      participantId: participants.id,
      applicationId: participants.applicationId,
      phone: applications.phoneNormalized,
      birthDate: applications.birthDate,
    })
    .from(participants)
    .innerJoin(
      applications,
      and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId)),
    )
    .where(
      and(
        eq(participants.tenantId, session.tenantId),
        eq(participants.eventId, parsed.data.eventId),
        eq(participants.linkTokenHash, hashSessionToken(parsed.data.linkToken, getEnv().LINK_TOKEN_PEPPER)),
        gt(participants.linkTokenExpiresAt, new Date()),
        isNull(participants.linkTokenUsedAt),
        isNull(participants.userId),
      ),
    )
    .limit(1);
  const target = rows[0];
  if (!target) return NextResponse.json({ code: "INVALID_OR_EXPIRED_LINK_TOKEN" }, { status: 409 });
  const verified =
    (parsed.data.phoneLastFour && verifyLastFour(target.phone, parsed.data.phoneLastFour)) ||
    (parsed.data.birthDate && parsed.data.birthDate === target.birthDate);
  if (!verified) return NextResponse.json({ code: "AUXILIARY_VERIFICATION_FAILED" }, { status: 403 });
  const alreadyLinked = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.tenantId, session.tenantId),
        eq(participants.eventId, parsed.data.eventId),
        eq(participants.userId, session.userId),
      ),
    )
    .limit(1);
  if (alreadyLinked[0]) return NextResponse.json({ code: "LINE_ALREADY_LINKED" }, { status: 409 });
  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ userId: session.userId, linkTokenUsedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(participants.id, target.participantId),
          isNull(participants.userId),
          isNull(participants.linkTokenUsedAt),
        ),
      );
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId: parsed.data.eventId,
      action: "participant.line_link",
      targetType: "participant",
      targetId: target.participantId,
      requestId,
    });
  });
  return NextResponse.json({ data: { linked: true } });
}
