import type { StaffRole } from "../events/transitions";
import type { Permission } from "./authorize";
import { hasPermission } from "./authorize";

export function staffPermissionSelectionBlocker(input: {
  actorRole: StaffRole;
  actorPermissions?: readonly Permission[] | null;
  nextPermissions: readonly Permission[];
}): string | null {
  return input.nextPermissions.every((permission) => hasPermission(input.actorRole, permission, input.actorPermissions))
    ? null
    : "CANNOT_GRANT_PERMISSION";
}

export function staffAccessChangeBlocker(input: {
  actorUserId: string;
  targetUserId: string;
  targetRole: StaffRole;
  nextRole: StaffRole;
  nextStatus: "active" | "locked" | "disabled";
  targetPermissions?: readonly Permission[] | null;
  nextPermissions?: readonly Permission[] | null;
  activeSystemAdminCount: number;
}): string | null {
  const targetCanManageStaff = input.targetPermissions?.includes("staff:manage") ?? input.targetRole === "system_admin";
  const nextCanManageStaff = input.nextPermissions?.includes("staff:manage") ?? input.nextRole === "system_admin";
  if (input.actorUserId === input.targetUserId && (input.nextStatus !== "active" || !nextCanManageStaff))
    return "CANNOT_REMOVE_OWN_ACCESS";
  if (
    targetCanManageStaff &&
    (!nextCanManageStaff || input.nextStatus !== "active") &&
    input.activeSystemAdminCount <= 1
  )
    return "LAST_SYSTEM_ADMIN";
  return null;
}
