"use client";

import { useState } from "react";

export type ConciergeEventSettingsInput = {
  enabled: boolean;
  accessOpensAt: string | null;
  accessClosesAt: string | null;
  allowResubmission: boolean;
};

const messages: Record<string, string> = {
  DIAGNOSIS_INVALID_SETTINGS: "利用開始日時は終了日時より前にしてください。",
  DIAGNOSIS_SNAPSHOT_INVALID: "テンプレート形式に対応する設問・8感情・8カードの設定を確認してください。",
};

export function useConciergeEventSettings(eventId: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(input: ConciergeEventSettingsInput) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/concierge-status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(messages[result.code] ?? `保存できませんでした（${result.code ?? response.status}）。`);
        return false;
      }
      setMessage("参加者向けSHIME診断の設定を保存しました。");
      return true;
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, save };
}
