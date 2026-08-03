"use client";

import { useMemo, useState } from "react";
import { useLineRichMenu } from "@shime/web/hooks/use-line-rich-menu";

export function LineRichMenuConsole() {
  const { state, busy, message, publish: applyRichMenu } = useLineRichMenu();
  const [eventId, setEventId] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const selectedEventId = resolveSelectedEventId(eventId, state);
  const event = useMemo(
    () => state?.events.find((candidate) => candidate.id === selectedEventId),
    [selectedEventId, state],
  );
  const ready = Boolean(state?.enabled && state.liffConfigured && event);

  async function confirmAndPublish() {
    if (!state || !event || !confirmed || busy) return;
    const accepted = window.confirm(
      `LINE公式アカウントの既定リッチメニューを「${event.name}」用に変更します。\n\n友だち全員に影響します。実行しますか？`,
    );
    if (!accepted) return;
    if (await applyRichMenu(selectedEventId)) setConfirmed(false);
  }

  return (
    <section className="panel wide">
      <h2>LINEリッチメニュー生成</h2>
      <p>
        選択したイベントの参加者画面を開く、SHIME標準リッチメニューを新しい版として生成します。既存画像の上書きはしません。
      </p>
      {message && <p role="status">{message}</p>}
      {!state ? (
        <p>読み込み中…</p>
      ) : (
        <>
          <dl>
            <dt>現在の既定メニュー</dt>
            <dd>{currentMenuLabel(state.current)}</dd>
          </dl>
          <div className="login-form">
            <label>
              開くイベント
              <select value={selectedEventId} onChange={(e) => setEventId(e.target.value)} disabled={busy}>
                {state.events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} / {formatDate(item.startsAt)} / {item.status}
                  </option>
                ))}
              </select>
            </label>
            <div className="result-card">
              <p className="eyebrow">RICH MENU PREVIEW</p>
              <h3>SHIME®</h3>
              <p className="hero-copy">OPEN SHIME</p>
              <p>{event?.name ?? "イベントを選択してください"}</p>
              <span className="button-link">TAP TO OPEN</span>
            </div>
            <p className="hint">
              LINE公式アカウントの友だち全員に適用されます。反映には最大1分ほどかかることがあり、LINEのトークを開き直すと確認できます。PC版LINEには表示されません。
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy || !ready}
              />{" "}
              対象イベントと全利用者への影響を確認しました
            </label>
            <button type="button" disabled={busy || !confirmed || !ready} onClick={() => void confirmAndPublish()}>
              {busy ? "生成・反映中…" : "リッチメニューを生成して既定に反映"}
            </button>
            {!state.enabled && <p className="hint">LINE接続を有効化してから実行してください。</p>}
            {!state.liffConfigured && <p className="hint">LIFF IDを保存してから実行してください。</p>}
          </div>
          {state.history.length > 0 && (
            <details>
              <summary>過去の生成履歴（{state.history.length}件）</summary>
              <ul>
                {state.history.map((item) => (
                  <li key={`${item.richMenuId}-${item.appliedAt}`}>
                    {item.eventName} / {formatDate(item.appliedAt)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function resolveSelectedEventId(eventId: string, state: ReturnType<typeof useLineRichMenu>["state"]) {
  return eventId || state?.current?.eventId || state?.events[0]?.id || "";
}

function currentMenuLabel(current: NonNullable<ReturnType<typeof useLineRichMenu>["state"]>["current"]) {
  return current
    ? `${current.eventName}（${formatDate(current.appliedAt)}反映）`
    : "SHIME管理画面からの反映記録はありません";
}
