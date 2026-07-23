import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@shime/core";
import { auditLogs, getDatabase, passwordCredentials, staffRoles, userIdentities, users } from "@shime/db";
import { getEnv } from "../../../../env";
import { requireStaffSession } from "../../../../server/auth";

const input = z.object({
  loginId: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9][a-z0-9._-]*$/),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(["reception", "operator", "manager", "system_admin"]),
});

export async function GET() {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  if (session.role !== "system_admin") return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  const data = await getDatabase()
    .select({
      id: users.id,
      displayName: users.displayName,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      loginId: userIdentities.providerUserId,
      role: staffRoles.role,
    })
    .from(users)
    .innerJoin(
      userIdentities,
      and(
        eq(userIdentities.userId, users.id),
        eq(userIdentities.tenantId, users.tenantId),
        eq(userIdentities.provider, "password"),
      ),
    )
    .innerJoin(
      staffRoles,
      and(eq(staffRoles.userId, users.id), eq(staffRoles.tenantId, users.tenantId), isNull(staffRoles.eventId)),
    )
    .where(and(eq(users.tenantId, session.tenantId), eq(users.type, "staff")));
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  if (session.role !== "system_admin")
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  const db = getDatabase();
  const duplicate = await db
    .select({ id: userIdentities.id })
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.tenantId, session.tenantId),
        eq(userIdentities.provider, "password"),
        eq(userIdentities.providerUserId, parsed.data.loginId),
      ),
    )
    .limit(1);
  if (duplicate[0])
    return NextResponse.json({ code: "LOGIN_ID_ALREADY_EXISTS", request_id: requestId }, { status: 409 });
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(parsed.data.password, getEnv().PASSWORD_PEPPER);
  } catch {
    return NextResponse.json({ code: "PASSWORD_POLICY", request_id: requestId }, { status: 400 });
  }
  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ tenantId: session.tenantId, type: "staff", displayName: parsed.data.displayName })
      .returning();
    if (!user) throw new Error("USER_CREATE_FAILED");
    await tx.insert(userIdentities).values({
      tenantId: session.tenantId,
      userId: user.id,
      provider: "password",
      providerUserId: parsed.data.loginId,
      verifiedAt: new Date(),
    });
    await tx.insert(passwordCredentials).values({ tenantId: session.tenantId, userId: user.id, passwordHash });
    await tx
      .insert(staffRoles)
      .values({ tenantId: session.tenantId, userId: user.id, eventId: null, role: parsed.data.role });
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "staff.create",
      targetType: "user",
      targetId: user.id,
      after: { displayName: parsed.data.displayName, loginId: parsed.data.loginId, role: parsed.data.role },
      requestId,
    });
    return user;
  });
  return NextResponse.json({ data: { id: created.id } }, { status: 201 });
}
