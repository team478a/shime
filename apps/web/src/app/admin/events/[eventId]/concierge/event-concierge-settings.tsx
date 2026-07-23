"use client";

import { useState } from "react";

export function EventConciergeSettings({ eventId, eventName, current, versions }: {
  eventId: string;
  eventName: string;
  current: { templateVersionId: string; templateVersion: number; snapshotHash: string; enabled: boolean } | null;
  versions: { id: string; version: number; name: string }[];
}) {
  const [selected, setSelected] = useState(current?.templateVersionId ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!selected || !window.confirm("公開済みテンプレートの内容を、このイベント専用スナップショットとして保存しますか？")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/events/${eventId}/concierge-settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateVersionId: selected }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? "イベント専用スナップショットを保存しました。参加者向け機能はまだOFFです。" : `保存できませんでした（${result.code ?? response.status}）。`);
    if (response.ok) window.location.reload();
  }
  return <section className="panel wide admin-panel">
    <p className="eyebrow">CONCIERGE EVENT SNAPSHOT</p>
    <h1>{eventName} 診断テンプレート</h1>
    <p>テンプレートをイベント専用にコピーします。コピー後に元テンプレートを変更しても、このイベントの履歴は変わりません。</p>
    <p className="notice">Phase 1Aでは参加者向け機能は常にOFFです。外部AI処理も実行されません。</p>
    <label>公開済みテンプレート<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">選択してください</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.name} / v{version.version}</option>)}</select></label>
    {current && <dl><dt>現在の版</dt><dd>v{current.templateVersion}</dd><dt>機能状態</dt><dd>{current.enabled ? "ON" : "OFF"}</dd><dt>スナップショット</dt><dd>{current.snapshotHash.slice(0, 12)}…</dd></dl>}
    <div className="actions"><button type="button" disabled={busy || !selected} onClick={save}>{busy ? "保存中…" : "イベントへ適用"}</button><a className="button-link secondary" href="/admin">管理トップへ</a></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
