import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@shime/core";
import { auditLogs, getDatabase, passwordCredentials, staffRoles, userIdentities, users } from "@shime/db";
import { getEnv } from "../../../../env";
import { BusinessRuleError, ValidationError } from "../../../../server/api/errors";
import { parseJsonBody, staffHandler } from "../../../../server/api/staff-handler";

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

export const GET = staffHandler(
  { permission: "staff:manage", includeRequestIdInAuthErrors: false },
  async ({ session }) => {
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
  },
);

export const POST = staffHandler({ permission: "staff:manage" }, async ({ requestId, session }, request: Request) => {
  const data = await parseJsonBody(request, input);
  const db = getDatabase();
  const duplicate = await db
    .select({ id: userIdentities.id })
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.tenantId, session.tenantId),
        eq(userIdentities.provider, "password"),
        eq(userIdentities.providerUserId, data.loginId),
      ),
    )
    .limit(1);
  if (duplicate[0]) throw new BusinessRuleError("LOGIN_ID_ALREADY_EXISTS");
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(data.password, getEnv().PASSWORD_PEPPER);
  } catch {
    throw new ValidationError("PASSWORD_POLICY");
  }
  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ tenantId: session.tenantId, type: "staff", displayName: data.displayName })
      .returning();
    if (!user) throw new Error("USER_CREATE_FAILED");
    await tx.insert(userIdentities).values({
      tenantId: session.tenantId,
      userId: user.id,
      provider: "password",
      providerUserId: data.loginId,
      verifiedAt: new Date(),
    });
    await tx.insert(passwordCredentials).values({ tenantId: session.tenantId, userId: user.id, passwordHash });
    await tx.insert(staffRoles).values({ tenantId: session.tenantId, userId: user.id, eventId: null, role: data.role });
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "staff.create",
      targetType: "user",
      targetId: user.id,
      after: { displayName: data.displayName, loginId: data.loginId, role: data.role },
      requestId,
    });
    return user;
  });
  return NextResponse.json({ data: { id: created.id } }, { status: 201 });
});
