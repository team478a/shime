export type DuplicateResolution = "same_person" | "different_person" | "on_hold";

export const DUPLICATE_RESOLUTION_LABELS: Record<DuplicateResolution, string> = {
  same_person: "同一人物",
  different_person: "別人",
  on_hold: "保留",
};

export const DUPLICATE_REASON_PRESETS: Record<DuplicateResolution, Array<{ value: string; label: string }>> = {
  same_person: [
    { value: "identity_confirmed", label: "本人へ確認済み" },
    { value: "same_contact_and_birth_date", label: "連絡先と生年月日が一致" },
    { value: "duplicate_application", label: "同じ申込みの再送信" },
    { value: "other", label: "その他" },
  ],
  different_person: [
    { value: "identity_confirmed", label: "本人確認で別人と判定" },
    { value: "same_name", label: "同姓同名の別人" },
    { value: "shared_contact", label: "連絡先を共有している別人" },
    { value: "other", label: "その他" },
  ],
  on_hold: [
    { value: "participant_check_pending", label: "申込者へ確認中" },
    { value: "organizer_check_pending", label: "主催者へ確認中" },
    { value: "insufficient_information", label: "判定情報が不足" },
    { value: "other", label: "その他" },
  ],
};

export const DUPLICATE_MATCH_REASON_LABELS: Record<string, string> = {
  phone: "電話番号が一致",
  email: "メールアドレスが一致",
  full_name_and_birth_date: "氏名と生年月日が一致",
};

export function buildDuplicateResolutionReason(resolution: DuplicateResolution, presetValue: string, note: string) {
  const preset = DUPLICATE_REASON_PRESETS[resolution].find((item) => item.value === presetValue);
  const trimmedNote = note.trim();
  if (!preset) return null;
  if (preset.value === "other" && !trimmedNote) return null;
  return trimmedNote ? `${preset.label}: ${trimmedNote}` : preset.label;
}
