import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpaqueToken, PARTICIPANT_SESSION_TTL_SECONDS } from "@shime/core";
import { events, getDatabase, participantSessions, participants, userIdentities, users } from "@shime/db";
import { getEnv } from "@shime/web/env";
import { getLineProvider } from "@shime/web/server/line-provider";
import { PARTICIPANT_COOKIE } from "@shime/web/server/participant-auth";

const input = z.object({ eventId: z.string().uuid(), idToken: z.string().min(20).max(10_000) });
export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const db = getDatabase();
  const eventRows = await db
    .select({ tenantId: events.tenantId })
    .from(events)
    .where(eq(events.id, parsed.data.eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) return NextResponse.json({ code: "EVENT_NOT_FOUND" }, { status: 404 });
  let verified;
  try {
    verified = await (await getLineProvider(event.tenantId)).verifyIdToken(parsed.data.idToken);
  } catch (error) {
    return NextResponse.json({ code: error instanceof Error ? error.message : "INVALID_TOKEN" }, { status: 401 });
  }
  let identity = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.tenantId, event.tenantId),
        eq(userIdentities.provider, "line"),
        eq(userIdentities.providerUserId, verified.lineUserId),
      ),
    )
    .limit(1);
  if (!identity[0]) {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ tenantId: event.tenantId, type: "participant", displayName: "LINE participant" })
        .returning();
      if (!user) throw new Error("USER_CREATE_FAILED");
      await tx.insert(userIdentities).values({
        tenantId: event.tenantId,
        userId: user.id,
        provider: "line",
        providerUserId: verified.lineUserId,
        verifiedAt: new Date(),
      });
      return user.id;
    });
    identity = [{ userId: result }];
  }
  const userId = identity[0]?.userId;
  if (!userId) throw new Error("USER_ID_MISSING");
  const opaque = createOpaqueToken(getEnv().SESSION_PEPPER);
  const expiresAt = new Date(Date.now() + PARTICIPANT_SESSION_TTL_SECONDS * 1000);
  await db
    .insert(participantSessions)
    .values({ tenantId: event.tenantId, userId, tokenHash: opaque.tokenHash, expiresAt });
  const linked = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.tenantId, event.tenantId),
        eq(participants.eventId, parsed.data.eventId),
        eq(participants.userId, userId),
      ),
    )
    .limit(1);
  const response = NextResponse.json({ data: { linked: Boolean(linked[0]) } });
  response.cookies.set(PARTICIPANT_COOKIE, opaque.token, {
    httpOnly: true,
    secure: getEnv().APP_ENV !== "development" && getEnv().APP_ENV !== "test",
    sameSite: "lax",
    path: "/",
    maxAge: PARTICIPANT_SESSION_TTL_SECONDS,
  });
  return response;
}
