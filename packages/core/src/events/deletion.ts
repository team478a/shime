export function eventDeletionBlocker(input: {
  status: string;
  confirmCode: string;
  eventCode: string;
  hasOperationalData: boolean;
}): string | null {
  if (input.status !== "draft") return "ONLY_DRAFT_EVENT_CAN_BE_DELETED";
  if (input.confirmCode !== input.eventCode) return "EVENT_CODE_MISMATCH";
  if (input.hasOperationalData) return "EVENT_HAS_OPERATIONAL_DATA";
  return null;
}
