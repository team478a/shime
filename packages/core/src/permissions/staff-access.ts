import type { StaffRole } from "../events/transitions";

export function staffAccessChangeBlocker(input: { actorUserId: string; targetUserId: string; targetRole: StaffRole; nextRole: StaffRole; nextStatus: "active" | "locked" | "disabled"; activeSystemAdminCount: number }): string | null {
  if (input.actorUserId === input.targetUserId && (input.nextStatus !== "active" || input.nextRole !== "system_admin")) return "CANNOT_REMOVE_OWN_ACCESS";
  if (input.targetRole === "system_admin" && (input.nextRole !== "system_admin" || input.nextStatus !== "active") && input.activeSystemAdminCount <= 1) return "LAST_SYSTEM_ADMIN";
  return null;
}
