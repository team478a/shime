"use client";

import { useMemo, useState } from "react";
import { type LineRichMenuAppearance, useLineRichMenu } from "@shime/web/hooks/use-line-rich-menu";

const STANDARD_APPEARANCE: LineRichMenuAppearance = {
  menuNameTemplate: "SHIME {eventName}",
  chatBarText: "SHIMEを開く",
  actionLabel: "SHIMEを開く",
  title: "SHIME",
  headline: "OPEN",
  buttonText: "TAP",
  backgroundColor: "#FFF8F7",
  panelColor: "#FFFFFF",
  accentColor: "#BF4C68",
  textColor: "#2D2A2C",
};

export function LineRichMenuConsole() {
  const { state, busy, message, publish: applyRichMenu, saveSettings } = useLineRichMenu();
  const [eventId, setEventId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [appearanceOverride, setAppearanceOverride] = useState<LineRichMenuAppearance | null>(null);
  const appearance = appearanceOverride ?? state?.appearance ?? STANDARD_APPEARANCE;

  const selectedEventId = resolveSelectedEventId(eventId, state);
  const event = useMemo(
    () => state?.events.find((candidate) => candidate.id === selectedEventId),
    [selectedEventId, state],
  );
  const ready = isReady(state, event);
  const settingsChanged = hasSettingsChanged(state?.appearance, appearanceOverride);

  function updateAppearance<Key extends keyof LineRichMenuAppearance>(key: Key, value: LineRichMenuAppearance[Key]) {
    setAppearanceOverride((current) => ({ ...(current ?? appearance), [key]: value }));
    setConfirmed(false);
  }

  async function saveAppearance() {
    if (busy || !settingsChanged) return;
    if (await saveSettings(appearance)) setAppearanceOverride(null);
  }

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
        文言と配色を管理画面で保存し、選択したイベントの参加者画面を開くリッチメニューを新しい版として生成します。既存画像の上書きはしません。
      </p>
      <StatusMessage message={message} />
      {!state ? (
        <p>読み込み中…</p>
      ) : (
        <>
          <dl>
            <dt>現在の既定メニュー</dt>
            <dd>{currentMenuLabel(state.current)}</dd>
            <dt>保存中の設定版</dt>
            <dd>{state.draft ? `v${state.draft.version}（${formatDate(state.draft.updatedAt)}保存）` : "標準設定"}</dd>
          </dl>
          <div className="login-form">
            <fieldset disabled={busy}>
              <legend>表示文言</legend>
              <label>
                LINE管理上のメニュー名
                <input
                  value={appearance.menuNameTemplate}
                  maxLength={300}
                  onChange={(e) => updateAppearance("menuNameTemplate", e.target.value)}
                />
                <span className="hint">{"{eventName}"}は選択したイベント名に置き換えます。</span>
              </label>
              <label>
                トーク画面下のメニューバー文言
                <input
                  value={appearance.chatBarText}
                  maxLength={14}
                  onChange={(e) => updateAppearance("chatBarText", e.target.value)}
                />
              </label>
              <label>
                タップ操作名
                <input
                  value={appearance.actionLabel}
                  maxLength={20}
                  onChange={(e) => updateAppearance("actionLabel", e.target.value)}
                />
              </label>
              <label>
                画像上部（半角英大文字・数字12文字まで）
                <input
                  value={appearance.title}
                  maxLength={12}
                  pattern="[A-Z0-9 ]+"
                  onChange={(e) => updateAppearance("title", e.target.value.toUpperCase())}
                />
              </label>
              <label>
                画像中央（半角英大文字・数字12文字まで）
                <input
                  value={appearance.headline}
                  maxLength={12}
                  pattern="[A-Z0-9 ]+"
                  onChange={(e) => updateAppearance("headline", e.target.value.toUpperCase())}
                />
              </label>
              <label>
                画像ボタン（半角英大文字・数字10文字まで）
                <input
                  value={appearance.buttonText}
                  maxLength={10}
                  pattern="[A-Z0-9 ]+"
                  onChange={(e) => updateAppearance("buttonText", e.target.value.toUpperCase())}
                />
              </label>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>配色</legend>
              {(
                [
                  ["backgroundColor", "背景色"],
                  ["panelColor", "パネル色"],
                  ["accentColor", "アクセント色"],
                  ["textColor", "文字色"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input type="color" value={appearance[key]} onChange={(e) => updateAppearance(key, e.target.value)} />
                  <input
                    value={appearance[key]}
                    maxLength={7}
                    pattern="#[0-9A-Fa-f]{6}"
                    onChange={(e) => updateAppearance(key, e.target.value.toUpperCase())}
                  />
                </label>
              ))}
            </fieldset>
            <div className="action-row">
              <button type="button" disabled={busy || !settingsChanged} onClick={() => void saveAppearance()}>
                設定を新しい版として保存
              </button>
              <button
                type="button"
                className="button-link"
                disabled={busy}
                onClick={() => setAppearanceOverride(STANDARD_APPEARANCE)}
              >
                標準設定に戻す
              </button>
            </div>
            {settingsChanged && <p role="status">未保存の変更があります。反映前に設定を保存してください。</p>}
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
            <div
              className="result-card"
              style={{
                backgroundColor: appearance.backgroundColor,
                color: appearance.textColor,
                borderColor: appearance.accentColor,
              }}
            >
              <p className="eyebrow">RICH MENU PREVIEW</p>
              <h3 style={{ color: appearance.accentColor }}>{appearance.title}</h3>
              <p className="hero-copy">{appearance.headline}</p>
              <p>{event?.name ?? "イベントを選択してください"}</p>
              <span
                className="button-link"
                style={{ backgroundColor: appearance.accentColor, color: appearance.panelColor }}
              >
                {appearance.buttonText}
              </span>
            </div>
            <p className="hint">
              LINE公式アカウントの友だち全員に適用されます。反映には最大1分ほどかかることがあり、LINEのトークを開き直すと確認できます。PC版LINEには表示されません。
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy || !ready || settingsChanged}
              />{" "}
              対象イベントと全利用者への影響を確認しました
            </label>
            <button
              type="button"
              disabled={busy || !confirmed || !ready || settingsChanged}
              onClick={() => void confirmAndPublish()}
            >
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
                    {item.settingsVersion ? ` / 設定v${item.settingsVersion}` : " / 標準設定"}
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

function isReady(
  state: ReturnType<typeof useLineRichMenu>["state"],
  event: NonNullable<ReturnType<typeof useLineRichMenu>["state"]>["events"][number] | undefined,
) {
  return Boolean(state?.enabled && state.liffConfigured && event);
}

function hasSettingsChanged(saved: LineRichMenuAppearance | undefined, override: LineRichMenuAppearance | null) {
  if (!override) return false;
  return JSON.stringify(override) !== JSON.stringify(saved ?? STANDARD_APPEARANCE);
}

function StatusMessage({ message }: { message: string }) {
  return message ? <p role="status">{message}</p> : null;
}
