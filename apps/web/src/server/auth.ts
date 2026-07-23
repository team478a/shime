import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { hashSessionToken, SESSION_COOKIE } from "@shime/core";
import { getDatabase, staffRoles, staffSessions, users } from "@shime/db";
import { getEnv } from "../env";

export async function getStaffSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDatabase();
  const now = new Date();
  const rows = await db
    .select({
      userId: users.id,
      tenantId: users.tenantId,
      displayName: users.displayName,
      role: staffRoles.role,
      eventId: staffRoles.eventId,
    })
    .from(staffSessions)
    .innerJoin(users, and(eq(users.id, staffSessions.userId), eq(users.tenantId, staffSessions.tenantId)))
    .innerJoin(staffRoles, and(eq(staffRoles.userId, users.id), eq(staffRoles.tenantId, users.tenantId)))
    .where(
      and(
        eq(staffSessions.tokenHash, hashSessionToken(token, getEnv().SESSION_PEPPER)),
        isNull(staffSessions.revokedAt),
        gt(staffSessions.expiresAt, now),
        eq(users.status, "active"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function requireStaffSession() {
  const session = await getStaffSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
