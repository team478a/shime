export const EVENT_STATUSES = [
  "draft",
  "accepting",
  "registration_closed",
  "checkin_open",
  "in_progress",
  "preference_open",
  "preference_closed",
  "result_confirmed",
  "completed",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
export type StaffRole = "reception" | "operator" | "manager" | "system_admin";

const indexByStatus = new Map(EVENT_STATUSES.map((status, index) => [status, index]));

export function authorizeEventTransition(input: {
  from: EventStatus;
  to: EventStatus;
  role: StaffRole;
  reason?: string;
}): void {
  if (input.from === input.to) return;
  const fromIndex = indexByStatus.get(input.from)!;
  const toIndex = indexByStatus.get(input.to)!;
  const isForwardOneStep = toIndex === fromIndex + 1;
  const isBackward = toIndex < fromIndex;

  if (input.from === "result_confirmed" && input.role !== "system_admin") {
    throw new Error("Only system_admin can change a confirmed result state");
  }
  if (isBackward && !["manager", "system_admin"].includes(input.role)) {
    throw new Error("Only manager or system_admin can move an event backward");
  }
  if (isBackward && !input.reason?.trim()) {
    throw new Error("A reason is required when moving an event backward");
  }
  if (!isBackward && !isForwardOneStep) {
    throw new Error("Event states must move forward one step at a time");
  }
}
