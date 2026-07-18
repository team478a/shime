export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: "準備中",
  accepting: "申込受付中",
  registration_closed: "申込受付終了",
  checkin_open: "当日受付中",
  in_progress: "開催中",
  preference_open: "希望入力受付中",
  preference_closed: "希望入力終了",
  result_confirmed: "ご案内公開中",
  completed: "終了",
};

export function getParticipantEventStatusLabel(status: string) {
  return EVENT_STATUS_LABELS[status] ?? "イベント情報確認中";
}

export function formatParticipantEventDate(value: string | Date) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "long",
    timeStyle: "short",
  });
}
