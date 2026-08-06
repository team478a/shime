import type { StaffRole } from "../events/transitions";

export const permissions = [
  "checkin:write",
  "participant:read",
  "operations:read",
  "application:import",
  "application:duplicates",
  "notification:write",
  "event:write",
  "event:delete",
  "seating:write",
  "seating:publish",
  "preference:read",
  "result:confirm",
  "result:revoke",
  "backup:export",
  "backup:sensitive",
  "staff:manage",
  "concierge:manage",
  "concierge:publish",
  "concierge:private-read",
] as const;

export type Permission = (typeof permissions)[number];

const permissionSet = new Set<string>(permissions);

export function parsePermissions(value: unknown): Permission[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return [];
  const parsed = value.filter(
    (permission): permission is Permission => typeof permission === "string" && permissionSet.has(permission),
  );
  return parsed.length === value.length ? [...new Set(parsed)] : [];
}

const grants: Record<StaffRole, ReadonlySet<Permission>> = {
  reception: new Set(["checkin:write", "participant:read"]),
  operator: new Set([
    "checkin:write",
    "participant:read",
    "operations:read",
    "application:import",
    "application:duplicates",
    "notification:write",
    "seating:write",
    "backup:export",
  ]),
  manager: new Set([
    "checkin:write",
    "participant:read",
    "operations:read",
    "application:import",
    "application:duplicates",
    "notification:write",
    "event:write",
    "seating:write",
    "seating:publish",
    "preference:read",
    "result:confirm",
    "backup:export",
    "backup:sensitive",
    "concierge:manage",
    "concierge:publish",
  ]),
  system_admin: new Set([
    "checkin:write",
    "participant:read",
    "operations:read",
    "application:import",
    "application:duplicates",
    "notification:write",
    "event:write",
    "event:delete",
    "seating:write",
    "seating:publish",
    "preference:read",
    "result:confirm",
    "result:revoke",
    "backup:export",
    "backup:sensitive",
    "staff:manage",
    "concierge:manage",
    "concierge:publish",
    "concierge:private-read",
  ]),
};

export function permissionsForRole(role: StaffRole): Permission[] {
  return permissions.filter((permission) => grants[role].has(permission));
}

export function hasPermission(
  role: StaffRole,
  permission: Permission,
  explicitPermissions?: readonly Permission[] | null,
): boolean {
  return explicitPermissions ? explicitPermissions.includes(permission) : grants[role].has(permission);
}

export function requirePermission(
  role: StaffRole,
  permission: Permission,
  explicitPermissions?: readonly Permission[] | null,
): void {
  if (!hasPermission(role, permission, explicitPermissions)) throw new Error("Forbidden");
}
