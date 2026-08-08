"use client";

import { useState } from "react";

import { useConciergeEventSettings } from "../../../../../hooks/use-concierge-event-settings";

type CurrentSettings = {
  templateVersionId: string;
  templateVersion: number;
  snapshotHash: string;
  enabled: boolean;
  accessOpensAt: string | null;
  accessClosesAt: string | null;
  allowResubmission: boolean;
};

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EventConciergeSettings({
  eventId,
  eventName,
  current,
  versions,
  summary,
}: {
  eventId: string;
  eventName: string;
  current: CurrentSettings | null;
  versions: { id: string; version: number; schemaVersion: number; name: string }[];
  summary: { eligibleCount: number; notStartedCount: number; inProgressCount: number; submittedCount: number } | null;
}) {
  const [selected, setSelected] = useState(current?.templateVersionId ?? "");
  const [enabled, setEnabled] = useState(current?.enabled ?? false);
  const [accessOpensAt, setAccessOpensAt] = useState(toLocalInput(current?.accessOpensAt ?? null));
  const [accessClosesAt, setAccessClosesAt] = useState(toLocalInput(current?.accessClosesAt ?? null));
  const [allowResubmission, setAllowResubmission] = useState(current?.allowResubmission ?? false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const eventSettings = useConciergeEventSettings(eventId);
  async function save() {
    if (
      !selected ||
      !window.confirm("公開済みテンプレートの内容を、このイベント専用スナップショットとして保存しますか？")
    )
      return;
    setBusy(true);
    const response = await fetch(`/api/admin/events/${eventId}/concierge-settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateVersionId: selected }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      response.ok
        ? "イベント専用スナップショットを保存しました。参加者向け機能はまだOFFです。"
        : `保存できませんでした（${result.code ?? response.status}）。`,
    );
    if (response.ok) window.location.reload();
  }
  return (
    <section className="panel wide admin-panel">
      <p className="eyebrow">CONCIERGE EVENT SNAPSHOT</p>
      <h1>{eventName} 診断テンプレート</h1>
      <p>
        テンプレートをイベント専用にコピーします。コピー後に元テンプレートを変更しても、このイベントの履歴は変わりません。
      </p>
      <p className="notice">
        外部AI処理は実行されません。参加者向け公開には、テンプレート形式に対応する設問、8感情、8カードが揃ったスナップショットが必要です。
      </p>
      <label>
        公開済みテンプレート
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">選択してください</option>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.name} / v{version.version} / {version.schemaVersion === 2 ? "婚活版v2・3問" : "現行v1・4軸"}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <>
          <dl>
            <dt>現在の版</dt>
            <dd>v{current.templateVersion}</dd>
            <dt>機能状態</dt>
            <dd>{current.enabled ? "ON" : "OFF"}</dd>
            <dt>スナップショット</dt>
            <dd>{current.snapshotHash.slice(0, 12)}…</dd>
          </dl>
          {summary && (
            <dl className="diagnosis-status-summary">
              <dt>対象者</dt>
              <dd>{summary.eligibleCount}名</dd>
              <dt>未開始</dt>
              <dd>{summary.notStartedCount}名</dd>
              <dt>途中保存</dt>
              <dd>{summary.inProgressCount}名</dd>
              <dt>提出済み</dt>
              <dd>{summary.submittedCount}名</dd>
            </dl>
          )}
          <fieldset className="admin-settings-group">
            <legend>参加者向け公開設定</legend>
            <label className="choice">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              SHIME診断を利用可能にする
            </label>
            <label>
              利用開始日時（未入力なら制限なし）
              <input
                type="datetime-local"
                value={accessOpensAt}
                onChange={(event) => setAccessOpensAt(event.target.value)}
              />
            </label>
            <label>
              利用終了日時（未入力なら制限なし）
              <input
                type="datetime-local"
                value={accessClosesAt}
                onChange={(event) => setAccessClosesAt(event.target.value)}
              />
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={allowResubmission}
                onChange={(event) => setAllowResubmission(event.target.checked)}
              />
              提出後の回答見直しを許可する
            </label>
            <button
              type="button"
              disabled={eventSettings.busy}
              onClick={async () => {
                const saved = await eventSettings.save({
                  enabled,
                  accessOpensAt: accessOpensAt ? new Date(accessOpensAt).toISOString() : null,
                  accessClosesAt: accessClosesAt ? new Date(accessClosesAt).toISOString() : null,
                  allowResubmission,
                });
                if (saved) window.location.reload();
              }}
            >
              {eventSettings.busy ? "保存中…" : "公開設定を保存"}
            </button>
            {eventSettings.message && <p role="status">{eventSettings.message}</p>}
          </fieldset>
        </>
      )}
      <div className="actions">
        <button type="button" disabled={busy || !selected} onClick={save}>
          {busy ? "保存中…" : "イベントへ適用"}
        </button>
        <a className="button-link secondary" href="/admin">
          管理トップへ
        </a>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
