import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createOpaqueToken, QR_TOKEN_TTL_MS } from "@shime/core";
import { getDatabase, lovePassports } from "@shime/db";
import { getEnv } from "@shime/web/env";
import { participantHandler } from "@shime/web/server/api/participant-handler";

export const POST = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const db = getDatabase();
    const existing = await db
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
    if (!existing[0]) return NextResponse.json({ code: "PASSPORT_NOT_ISSUED" }, { status: 409 });
    const opaque = createOpaqueToken(getEnv().QR_TOKEN_PEPPER);
    const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS);
    const [updated] = await db
      .update(lovePassports)
      .set({
        qrTokenHash: opaque.tokenHash,
        qrVersion: existing[0].qrVersion + 1,
        qrIssuedAt: new Date(),
        qrExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(lovePassports.id, existing[0].id))
      .returning();
    return NextResponse.json({ data: { qrToken: opaque.token, expiresAt, version: updated?.qrVersion } });
  },
);
