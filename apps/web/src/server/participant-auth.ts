import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { hashSessionToken } from "@shime/core";
import { getDatabase, participantSessions, participants, users } from "@shime/db";
import { getEnv } from "../env";
export const PARTICIPANT_COOKIE = "shime_participant_session";
export async function requireParticipantSession() {
  const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized");
  const rows = await getDatabase()
    .select({ userId: users.id, tenantId: users.tenantId })
    .from(participantSessions)
    .innerJoin(users, and(eq(users.id, participantSessions.userId), eq(users.tenantId, participantSessions.tenantId)))
    .where(
      and(
        eq(participantSessions.tokenHash, hashSessionToken(token, getEnv().SESSION_PEPPER)),
        gt(participantSessions.expiresAt, new Date()),
        isNull(participantSessions.revokedAt),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("Unauthorized");
  return rows[0];
}
export async function requireParticipantForEvent(eventId: string) {
  const session = await requireParticipantSession();
  const rows = await getDatabase()
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.tenantId, session.tenantId),
        eq(participants.eventId, eventId),
        eq(participants.userId, session.userId),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  return { session, participant: rows[0] };
}
