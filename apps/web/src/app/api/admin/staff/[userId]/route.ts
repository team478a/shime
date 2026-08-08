import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  hashPassword,
  hasPermission,
  parsePermissions,
  permissions,
  staffAccessChangeBlocker,
  staffPermissionSelectionBlocker,
} from "@shime/core";
import { auditLogs, getDatabase, passwordCredentials, staffRoles, staffSessions, users } from "@shime/db";
import { getEnv } from "../../../../../env";
import { BusinessRuleError, ValidationError } from "../../../../../server/api/errors";
import { parseJsonBody, staffHandler } from "../../../../../server/api/staff-handler";

const input = z.object({
  displayName: z.string().trim().min(1).max(120),
  status: z.enum(["active", "locked", "disabled"]),
  role: z.enum(["reception", "operator", "manager", "system_admin"]),
  permissions: z
    .array(z.enum(permissions))
    .max(permissions.length)
    .refine((items) => new Set(items).size === items.length),
  password: z.string().min(12).max(128).optional(),
});

export const PATCH = staffHandler(
  { permission: "staff:manage" },
  async ({ requestId, session }, request: Request, { params }: { params: Promise<{ userId: string }> }) => {
    const data = await parseJsonBody(request, input);
    if (session.eventId) throw new BusinessRuleError("FORBIDDEN", 403);
    const permissionBlocker = staffPermissionSelectionBlocker({
      actorRole: session.role,
      actorPermissions: session.permissions,
      nextPermissions: data.permissions,
    });
    if (permissionBlocker) throw new BusinessRuleError(permissionBlocker, 403);
    const { userId } = await params;
    const db = getDatabase();
    const rows = await db
      .select({
        id: users.id,
        status: users.status,
        displayName: users.displayName,
        role: staffRoles.role,
        permissions: staffRoles.permissions,
      })
      .from(users)
      .innerJoin(
        staffRoles,
        and(eq(staffRoles.userId, users.id), eq(staffRoles.tenantId, users.tenantId), isNull(staffRoles.eventId)),
      )
      .where(and(eq(users.id, userId), eq(users.tenantId, session.tenantId), eq(users.type, "staff")))
      .limit(1);
    const target = rows[0];
    if (!target) throw new BusinessRuleError("NOT_FOUND", 404);
    const administrators = await db
      .select({ role: staffRoles.role, permissions: staffRoles.permissions })
      .from(users)
      .innerJoin(
        staffRoles,
        and(eq(staffRoles.userId, users.id), eq(staffRoles.tenantId, users.tenantId), isNull(staffRoles.eventId)),
      )
      .where(and(eq(users.tenantId, session.tenantId), eq(users.status, "active")));
    const activeStaffManagerCount = administrators.filter((administrator) =>
      hasPermission(administrator.role, "staff:manage", parsePermissions(administrator.permissions)),
    ).length;
    const blocker = staffAccessChangeBlocker({
      actorUserId: session.userId,
      targetUserId: userId,
      targetRole: target.role,
      nextRole: data.role,
      nextStatus: data.status,
      targetPermissions: parsePermissions(target.permissions),
      nextPermissions: data.permissions,
      activeSystemAdminCount: activeStaffManagerCount,
    });
    if (blocker) throw new BusinessRuleError(blocker);
    let passwordHash: string | undefined;
    if (data.password) {
      try {
        passwordHash = await hashPassword(data.password, getEnv().PASSWORD_PEPPER);
      } catch {
        throw new ValidationError("PASSWORD_POLICY");
      }
    }
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ displayName: data.displayName, status: data.status, updatedAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.tenantId, session.tenantId)));
      await tx
        .update(staffRoles)
        .set({ role: data.role, permissions: data.permissions, updatedAt: new Date() })
        .where(
          and(eq(staffRoles.userId, userId), eq(staffRoles.tenantId, session.tenantId), isNull(staffRoles.eventId)),
        );
      if (passwordHash)
        await tx
          .update(passwordCredentials)
          .set({
            passwordHash,
            passwordChangedAt: new Date(),
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(and(eq(passwordCredentials.userId, userId), eq(passwordCredentials.tenantId, session.tenantId)));
      if (
        passwordHash ||
        data.status !== "active" ||
        data.role !== target.role ||
        JSON.stringify(data.permissions) !== JSON.stringify(parsePermissions(target.permissions))
      )
        await tx
          .update(staffSessions)
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(staffSessions.userId, userId), eq(staffSessions.tenantId, session.tenantId)));
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "staff.update",
        targetType: "user",
        targetId: userId,
        before: {
          displayName: target.displayName,
          status: target.status,
          role: target.role,
          permissions: parsePermissions(target.permissions),
        },
        after: {
          displayName: data.displayName,
          status: data.status,
          role: data.role,
          permissions: data.permissions,
          passwordChanged: Boolean(passwordHash),
        },
        requestId,
      });
    });
    return NextResponse.json({ ok: true, request_id: requestId });
  },
);
