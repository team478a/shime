import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  isLocked,
  nextLockout,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifyPassword,
} from "@shime/core";
import {
  auditLogs,
  getDatabase,
  loginAttempts,
  passwordCredentials,
  staffSessions,
  tenants,
  userIdentities,
  users,
} from "@shime/db";
import { getEnv } from "../../../../env";

const inputSchema = z.object({
  tenantCode: z.string().trim().min(1).max(80),
  loginId: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(128),
});

function safeHash(value: string, pepper: string) {
  return createHash("sha256").update(`${value}\u0000${pepper}`).digest("hex");
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "入力内容を確認してください", request_id: requestId }, { status: 400 });
  }
  const env = getEnv();
  const db = getDatabase();
  const normalizedLoginId = parsed.data.loginId.toLowerCase();
  const loginIdHash = safeHash(normalizedLoginId, env.PASSWORD_PEPPER);

  const matches = await db.select({
    tenantId: tenants.id,
    userId: users.id,
    passwordHash: passwordCredentials.passwordHash,
    failedAttempts: passwordCredentials.failedAttempts,
    lockedUntil: passwordCredentials.lockedUntil,
  })
    .from(userIdentities)
    .innerJoin(users, and(eq(users.id, userIdentities.userId), eq(users.tenantId, userIdentities.tenantId)))
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .innerJoin(passwordCredentials, eq(passwordCredentials.userId, users.id))
    .where(and(
      eq(tenants.code, parsed.data.tenantCode),
      eq(tenants.status, "active"),
      eq(users.status, "active"),
      eq(userIdentities.provider, "password"),
      eq(userIdentities.providerUserId, normalizedLoginId),
    ))
    .limit(1);
  const match = matches[0];
  const valid = match && !isLocked(match.lockedUntil) && await verifyPassword(match.passwordHash, parsed.data.password, env.PASSWORD_PEPPER);

  if (!valid) {
    await db.transaction(async (tx) => {
      await tx.insert(loginAttempts).values({ tenantId: match?.tenantId, loginIdHash, success: false });
      if (match) {
        const failures = match.failedAttempts + 1;
        await tx.update(passwordCredentials).set({ failedAttempts: failures, lockedUntil: nextLockout(failures), updatedAt: new Date() }).where(eq(passwordCredentials.userId, match.userId));
      }
    });
    return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "ログインIDまたはパスワードが違います", request_id: requestId }, { status: 401 });
  }

  const { token, tokenHash } = createSessionToken(env.SESSION_PEPPER);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.transaction(async (tx) => {
    await tx.update(passwordCredentials).set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(passwordCredentials.userId, match.userId));
    await tx.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, match.userId));
    await tx.insert(staffSessions).values({ tenantId: match.tenantId, userId: match.userId, tokenHash, expiresAt });
    await tx.insert(loginAttempts).values({ tenantId: match.tenantId, loginIdHash, success: true });
    await tx.insert(auditLogs).values({ tenantId: match.tenantId, actorUserId: match.userId, action: "staff.login", targetType: "user", targetId: match.userId, requestId });
  });
  const response = NextResponse.json({ ok: true, request_id: requestId });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.APP_ENV !== "development" && env.APP_ENV !== "test",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const env = getEnv();
  const token = (await import("next/headers")).cookies().then((jar) => jar.get(SESSION_COOKIE)?.value);
  const rawToken = await token;
  if (rawToken) {
    await getDatabase().update(staffSessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(staffSessions.tokenHash, (await import("@shime/core")).hashSessionToken(rawToken, env.SESSION_PEPPER)));
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
