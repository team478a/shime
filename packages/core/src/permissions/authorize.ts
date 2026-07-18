import type { StaffRole } from "../events/transitions";

export type Permission =
  | "checkin:write"
  | "participant:read"
  | "operations:read"
  | "application:import"
  | "application:duplicates"
  | "notification:write"
  | "event:write"
  | "event:delete"
  | "seating:write"
  | "seating:publish"
  | "preference:read"
  | "result:confirm"
  | "result:revoke"
  | "backup:export"
  | "backup:sensitive";

const grants: Record<StaffRole, ReadonlySet<Permission>> = {
  reception: new Set(["checkin:write", "participant:read"]),
  operator: new Set(["checkin:write", "participant:read", "operations:read", "application:import", "application:duplicates", "notification:write", "seating:write", "backup:export"]),
  manager: new Set(["checkin:write", "participant:read", "operations:read", "application:import", "application:duplicates", "notification:write", "event:write", "seating:write", "seating:publish", "preference:read", "result:confirm", "backup:export", "backup:sensitive"]),
  system_admin: new Set(["checkin:write", "participant:read", "operations:read", "application:import", "application:duplicates", "notification:write", "event:write", "event:delete", "seating:write", "seating:publish", "preference:read", "result:confirm", "result:revoke", "backup:export", "backup:sensitive"]),
};

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return grants[role].has(permission);
}

export function requirePermission(role: StaffRole, permission: Permission): void {
  if (!hasPermission(role, permission)) throw new Error("Forbidden");
}
