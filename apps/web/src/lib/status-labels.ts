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

export const EVENT_STATUS_LABELS: Record<(typeof EVENT_STATUSES)[number], string> = {
  draft: "下書き",
  accepting: "申込受付中",
  registration_closed: "申込締切",
  checkin_open: "受付開始",
  in_progress: "イベント進行中",
  preference_open: "希望入力受付中",
  preference_closed: "希望入力締切",
  result_confirmed: "結果確定",
  completed: "完了",
};

export const PARTICIPANT_STATUS_LABELS = {
  invited: "招待中",
  confirmed: "参加確定",
  cancelled: "キャンセル",
  absent: "欠席",
  attended: "来場済み",
} as const;

export const PASSPORT_STATUS_LABELS = {
  issued: "発行済み",
  ready: "受付準備完了",
  checked_in: "受付済み",
  preference_submitted: "希望提出済み",
  result_available: "結果確認可能",
  completed: "完了",
} as const;

export const MATCH_CANDIDATE_STATUS_LABELS = {
  candidate: "成立候補",
  pending: "保留",
  approved: "承認",
  declined: "非承認",
  revoked: "承認取消",
} as const;

function statusLabel(labels: Readonly<Record<string, string>>, status: string): string {
  return labels[status] ?? "未定義の状態";
}

export const getEventStatusLabel = (status: string) => statusLabel(EVENT_STATUS_LABELS, status);
export const getParticipantStatusLabel = (status: string) => statusLabel(PARTICIPANT_STATUS_LABELS, status);
export const getPassportStatusLabel = (status: string) => statusLabel(PASSPORT_STATUS_LABELS, status);
export const getMatchCandidateStatusLabel = (status: string) => statusLabel(MATCH_CANDIDATE_STATUS_LABELS, status);
