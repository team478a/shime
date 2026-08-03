"use client";

import { useCallback, useEffect, useState } from "react";

export type LineRichMenuDeployment = {
  richMenuId: string;
  eventId: string;
  eventName: string;
  eventEntryUrl: string;
  appliedAt: string;
};

export type LineRichMenuState = {
  events: Array<{ id: string; name: string; status: string; startsAt: string }>;
  enabled: boolean;
  liffConfigured: boolean;
  current: LineRichMenuDeployment | null;
  history: LineRichMenuDeployment[];
};

const errors: Record<string, string> = {
  EVENT_NOT_FOUND: "選択したイベントを確認できませんでした。",
  LINE_DISABLED: "先にLINE接続を有効にしてください。",
  LIFF_NOT_CONFIGURED: "先にLIFF IDを保存してください。",
  LINE_NOT_CONFIGURED: "Channel Access Tokenを確認してください。",
  LINE_RICH_MENU_REQUEST_FAILED: "LINEへの登録に失敗しました。接続設定と権限を確認してください。",
  LINE_RICH_MENU_UNAVAILABLE: "LINEへ接続できませんでした。時間をおいて再試行してください。",
  LINE_RICH_MENU_IMAGE_FAILED: "リッチメニュー画像を生成できませんでした。",
  LINE_RICH_MENU_SAVE_FAILED: "反映記録の保存に失敗したため、LINE側の変更を元に戻しました。",
};

export function useLineRichMenu() {
  const [state, setState] = useState<LineRichMenuState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/platform/line-rich-menu");
      const body = await response.json();
      if (!response.ok) {
        setMessage(`読み込み失敗: ${body.code ?? "UNKNOWN_ERROR"}`);
        return null;
      }
      const next = body.data as LineRichMenuState;
      setState(next);
      return next;
    } catch {
      setMessage("管理APIへ接続できませんでした。画面を再読み込みしてください。");
      return null;
    }
  }, []);

  useEffect(() => {
    // Initial data comes from the authenticated admin API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const publish = useCallback(
    async (eventId: string) => {
      if (busy) return false;
      setBusy(true);
      setMessage("LINEへリッチメニューを登録しています。画面を閉じないでください…");
      try {
        const response = await fetch("/api/admin/platform/line-rich-menu", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, confirmation: "APPLY_DEFAULT_RICH_MENU" }),
        });
        const body = await response.json();
        if (!response.ok) {
          setMessage(errors[body.code] ?? `反映失敗: ${body.code ?? "UNKNOWN_ERROR"}`);
          return false;
        }
        setMessage("リッチメニューを作成し、LINE公式アカウントの既定メニューへ反映しました。");
        await load();
        return true;
      } catch {
        setMessage("管理APIへ接続できませんでした。LINEの状態を確認してから再試行してください。");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, load],
  );

  return { state, busy, message, publish };
}
