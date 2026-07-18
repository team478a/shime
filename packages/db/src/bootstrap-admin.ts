import "dotenv/config";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "@shime/core";
import { parseAdminBootstrapConfig } from "./bootstrap-admin-config";
import { createDatabase } from "./client";
import { auditLogs, passwordCredentials, staffRoles, tenants, userIdentities, users } from "./schema";

const config = parseAdminBootstrapConfig(process.env);
const { db, client } = createDatabase(config.databaseUrl);

try {
  const passwordHash = await hashPassword(config.password, config.passwordPepper);
  const result = await db.transaction(async (tx) => {
    const tenantRows = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.code, config.tenantCode)).limit(1);
    const tenant = tenantRows[0] ?? (await tx.insert(tenants).values({
      code: config.tenantCode,
      name: config.tenantName,
      timezone: "Asia/Tokyo",
    }).returning({ id: tenants.id }))[0];
    if (!tenant) throw new Error("Failed to create bootstrap tenant");

    const identityRows = await tx.select({ userId: userIdentities.userId, userType: users.type })
      .from(userIdentities)
      .innerJoin(users, and(eq(users.id, userIdentities.userId), eq(users.tenantId, userIdentities.tenantId)))
      .where(and(
        eq(userIdentities.tenantId, tenant.id),
        eq(userIdentities.provider, "password"),
        eq(userIdentities.providerUserId, config.loginId),
      ))
      .limit(1);
    const existingIdentity = identityRows[0];
    if (existingIdentity?.userType !== undefined && existingIdentity.userType !== "staff") {
      throw new Error("Bootstrap login ID is already assigned to a non-staff user");
    }

    let userId = existingIdentity?.userId;
    let created = false;
    if (!userId) {
      const [user] = await tx.insert(users).values({ tenantId: tenant.id, type: "staff", displayName: config.displayName }).returning({ id: users.id });
      if (!user) throw new Error("Failed to create bootstrap administrator");
      userId = user.id;
      created = true;
      await tx.insert(userIdentities).values({
        tenantId: tenant.id,
        userId,
        provider: "password",
        providerUserId: config.loginId,
        verifiedAt: new Date(),
      });
    }

    const credentialRows = await tx.select({ userId: passwordCredentials.userId })
      .from(passwordCredentials)
      .where(and(eq(passwordCredentials.tenantId, tenant.id), eq(passwordCredentials.userId, userId)))
      .limit(1);
    let passwordChanged = false;
    if (!credentialRows[0]) {
      await tx.insert(passwordCredentials).values({ tenantId: tenant.id, userId, passwordHash });
      passwordChanged = true;
    } else if (config.rotatePassword) {
      await tx.update(passwordCredentials).set({
        passwordHash,
        passwordChangedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      }).where(and(eq(passwordCredentials.tenantId, tenant.id), eq(passwordCredentials.userId, userId)));
      passwordChanged = true;
    }

    const roleRows = await tx.select({ id: staffRoles.id })
      .from(staffRoles)
      .where(and(
        eq(staffRoles.tenantId, tenant.id),
        eq(staffRoles.userId, userId),
        eq(staffRoles.role, "system_admin"),
        isNull(staffRoles.eventId),
      ))
      .limit(1);
    if (!roleRows[0]) {
      await tx.insert(staffRoles).values({ tenantId: tenant.id, userId, role: "system_admin", eventId: null });
    }

    if (created || passwordChanged || !roleRows[0]) {
      await tx.insert(auditLogs).values({
        tenantId: tenant.id,
        actorUserId: userId,
        action: created ? "staff.bootstrap.create" : "staff.bootstrap.update",
        targetType: "user",
        targetId: userId,
        reason: "initial administrator bootstrap",
        requestId: randomUUID(),
      });
    }

    return { created, passwordChanged, roleCreated: !roleRows[0] };
  });

  console.info(JSON.stringify({ status: "ok", ...result, eventCreated: false }));
} finally {
  await client.end();
}
