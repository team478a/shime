export const CHECKIN_CANCELLATION_REASONS = [
  "参加者都合",
  "受付操作の訂正",
  "重複受付の修正",
  "その他",
] as const;

export type CheckinCancellationReason = (typeof CHECKIN_CANCELLATION_REASONS)[number];

export function buildCheckinCancellationReason(preset: CheckinCancellationReason, note?: string): string {
  const normalizedNote = note?.trim() ?? "";
  if (preset === "その他" && !normalizedNote) throw new Error("Cancellation note is required for other");
  const reason = normalizedNote ? `${preset}: ${normalizedNote}` : preset;
  if (reason.length > 1_000) throw new Error("Cancellation reason is too long");
  return reason;
}
