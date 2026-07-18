import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, staffAccessChangeBlocker } from "@shime/core";
import { auditLogs, getDatabase, passwordCredentials, staffRoles, staffSessions, users } from "@shime/db";
import { getEnv } from "../../../../../env";
import { requireStaffSession } from "../../../../../server/auth";

const input = z.object({ displayName: z.string().trim().min(1).max(120), status: z.enum(["active", "locked", "disabled"]), role: z.enum(["reception", "operator", "manager", "system_admin"]), password: z.string().min(12).max(128).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const requestId = randomUUID(); const session = await requireStaffSession().catch(() => null); if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 }); if (session.role !== "system_admin") return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 }); const { userId } = await params;
  const db = getDatabase(); const rows = await db.select({ id: users.id, status: users.status, displayName: users.displayName, role: staffRoles.role }).from(users).innerJoin(staffRoles, and(eq(staffRoles.userId, users.id), eq(staffRoles.tenantId, users.tenantId), isNull(staffRoles.eventId))).where(and(eq(users.id, userId), eq(users.tenantId, session.tenantId), eq(users.type, "staff"))).limit(1); const target = rows[0]; if (!target) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const admins = await db.select({ id: users.id }).from(users).innerJoin(staffRoles, and(eq(staffRoles.userId, users.id), eq(staffRoles.tenantId, users.tenantId), isNull(staffRoles.eventId), eq(staffRoles.role, "system_admin"))).where(and(eq(users.tenantId, session.tenantId), eq(users.status, "active")));
  const blocker = staffAccessChangeBlocker({ actorUserId: session.userId, targetUserId: userId, targetRole: target.role, nextRole: parsed.data.role, nextStatus: parsed.data.status, activeSystemAdminCount: admins.length });
  if (blocker) return NextResponse.json({ code: blocker, request_id: requestId }, { status: 409 });
  let passwordHash: string | undefined; if (parsed.data.password) { try { passwordHash = await hashPassword(parsed.data.password, getEnv().PASSWORD_PEPPER); } catch { return NextResponse.json({ code: "PASSWORD_POLICY", request_id: requestId }, { status: 400 }); } }
  await db.transaction(async (tx) => { await tx.update(users).set({ displayName: parsed.data.displayName, status: parsed.data.status, updatedAt: new Date() }).where(and(eq(users.id, userId), eq(users.tenantId, session.tenantId))); await tx.update(staffRoles).set({ role: parsed.data.role, updatedAt: new Date() }).where(and(eq(staffRoles.userId, userId), eq(staffRoles.tenantId, session.tenantId), isNull(staffRoles.eventId))); if (passwordHash) await tx.update(passwordCredentials).set({ passwordHash, passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(and(eq(passwordCredentials.userId, userId), eq(passwordCredentials.tenantId, session.tenantId))); if (passwordHash || parsed.data.status !== "active" || parsed.data.role !== target.role) await tx.update(staffSessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(staffSessions.userId, userId), eq(staffSessions.tenantId, session.tenantId))); await tx.insert(auditLogs).values({ tenantId: session.tenantId, actorUserId: session.userId, action: "staff.update", targetType: "user", targetId: userId, before: { displayName: target.displayName, status: target.status, role: target.role }, after: { displayName: parsed.data.displayName, status: parsed.data.status, role: parsed.data.role, passwordChanged: Boolean(passwordHash) }, requestId }); });
  return NextResponse.json({ ok: true, request_id: requestId });
}
