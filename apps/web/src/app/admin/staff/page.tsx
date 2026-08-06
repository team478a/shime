import { and, eq, isNull } from "drizzle-orm";
import { hasPermission, parsePermissions, permissionsForRole } from "@shime/core";
import { getDatabase, staffRoles, userIdentities, users } from "@shime/db";
import { redirect } from "next/navigation";
import { getStaffSession } from "../../../server/auth";
import { StaffConsole } from "./staff-console";

export default async function StaffPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "staff:manage", session.permissions) || session.eventId) redirect("/admin");
  const rows = await getDatabase()
    .select({
      id: users.id,
      displayName: users.displayName,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      loginId: userIdentities.providerUserId,
      role: staffRoles.role,
      permissions: staffRoles.permissions,
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
  return (
    <main>
      <StaffConsole
        initial={rows.map((row) => ({
          ...row,
          permissions: parsePermissions(row.permissions) ?? permissionsForRole(row.role),
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </main>
  );
}
