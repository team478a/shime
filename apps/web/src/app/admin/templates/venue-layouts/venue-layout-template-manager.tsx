"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type VenueLayoutTemplateGroup = Readonly<{
  key: string;
  name: string;
  versions: ReadonlyArray<{
    id: string;
    version: number;
    active: boolean;
    tableCount: number;
    seatCount: number;
    createdAt: string;
    usageCount: number;
    lastUsed?: { eventName: string; appliedAt: string };
    preview: ReadonlyArray<{ tableCode: string; seatCodes: string[] }>;
  }>;
}>;

const reasonOptions = ["会場構成を変更したため", "重複して登録したため", "今後使用しないため", "その他"] as const;

export function VenueLayoutTemplateManager({ groups }: Readonly<{ groups: VenueLayoutTemplateGroup[] }>) {
  const router = useRouter();
  const [archiveId, setArchiveId] = useState("");
  const [restoreId, setRestoreId] = useState("");
  const [reason, setReason] = useState<(typeof reasonOptions)[number]>(reasonOptions[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function archive() {
    const fullReason = reason === "その他" ? detail.trim() : `${reason}${detail.trim() ? `（${detail.trim()}）` : ""}`;
    if (fullReason.length < 2) {
      setError(true);
      setMessage("アーカイブ理由を入力してください。");
      return;
    }
    if (!window.confirm("この版を新しいイベントのコピー元から外しますか？既存イベントと履歴は変更されません。")) return;
    setBusy(true);
    setError(false);
    setMessage("アーカイブしています…");
    try {
      const response = await fetch(`/api/admin/resource-templates/venue-layouts/${archiveId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "archive", reason: fullReason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(true);
        setMessage(result?.code === "ALREADY_ARCHIVED" ? "この版は既にアーカイブされています。" : "アーカイブできませんでした。");
        return;
      }
      setArchiveId("");
      setDetail("");
      setMessage("アーカイブしました。既存イベントと利用履歴は保持されています。");
      router.refresh();
    } catch {
      setError(true);
      setMessage("通信状態を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  async function restoreAsNewVersion(templateId: string, name: string, currentVersion: number) {
    if (!window.confirm(`「${name}」v${currentVersion}の内容を引き継ぎ、次の版を利用中として作成しますか？旧版は履歴のまま保持されます。`)) return;
    setRestoreId(templateId);
    setBusy(true);
    setError(false);
    setMessage("履歴から新しい版を作成しています…");
    try {
      const response = await fetch(`/api/admin/resource-templates/venue-layouts/${templateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_as_new_version" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data) {
        setError(true);
        setMessage(result?.code === "SOURCE_VERSION_STILL_ACTIVE" ? "この版は既に利用中です。" : "新しい版を作成できませんでした。");
        return;
      }
      setMessage(`「${result.data.name}」v${result.data.version}を利用中として作成しました。`);
      router.refresh();
    } catch {
      setError(true);
      setMessage("通信状態を確認してください。");
    } finally {
      setRestoreId("");
      setBusy(false);
    }
  }

  return <div className="admin-stack venue-template-page">
    <section className="panel wide">
      <p className="eyebrow">REUSABLE VENUE LAYOUTS</p>
      <h1>会場テンプレート管理</h1>
      <p>会場ごとのテーブル・席構成を版付きで管理します。過去の版とイベントへ適用した時点の構成は削除・上書きされません。</p>
      <div className="summary"><span>テンプレート {groups.length}件</span><span>有効 {groups.filter((group) => group.versions.some((version) => version.active)).length}件</span></div>
      {!groups.length && <p className="participant-empty">会場テンプレートはまだありません。イベントの「テーブル・席マスター」で現在の構成を保存できます。</p>}
    </section>

    {groups.map((group) => {
      const latest = group.versions[0];
      return <section className="panel wide venue-template-card" key={group.key}>
        <div className="venue-template-heading">
          <div><p className="eyebrow">VENUE LAYOUT</p><h2>{group.name}</h2></div>
          <span className={group.versions.some((version) => version.active) ? "status-badge status-complete" : "status-badge"}>{group.versions.some((version) => version.active) ? "利用中" : "アーカイブ済み"}</span>
        </div>
        {latest && <div className="summary"><span>最新 v{latest.version}</span><span>{latest.tableCount}卓</span><span>{latest.seatCount}席</span><span>適用 {group.versions.reduce((total, version) => total + version.usageCount, 0)}回</span></div>}
        <div className="table-layout-preview-grid venue-template-preview">
          {latest?.preview.map((table) => <article className="table-layout-preview-card" key={table.tableCode}>
            <div className="table-layout-preview-label"><small>TABLE</small><strong>{table.tableCode}</strong></div>
            <div className="table-layout-seat-chips">{table.seatCodes.map((seat) => <span key={seat}>{seat}</span>)}</div>
          </article>)}
        </div>
        <details className="table-setup-tool">
          <summary>版履歴と適用履歴（{group.versions.length}版）</summary>
          <div className="table-setup-tool-body venue-template-version-list">
            {group.versions.map((version) => <article key={version.id} className="venue-template-version">
              <div><strong>v{version.version}</strong> <span>{version.active ? "利用中" : "履歴"}</span></div>
              <p>{version.tableCount}卓・{version.seatCount}席／作成 {version.createdAt}</p>
              <p>イベント適用 {version.usageCount}回{version.lastUsed ? `／最終 ${version.lastUsed.eventName}（${version.lastUsed.appliedAt}）` : ""}</p>
              {version.active && <button type="button" className="secondary" onClick={() => { setArchiveId(version.id); setMessage(""); }}>この版をアーカイブ</button>}
              {!version.active && version.id === latest?.id && <button type="button" className="secondary" disabled={busy} onClick={() => restoreAsNewVersion(version.id, group.name, version.version)}>{restoreId === version.id ? "作成中…" : "この版から新しい版を作成"}</button>}
            </article>)}
          </div>
        </details>
      </section>;
    })}

    {archiveId && <section className="panel wide venue-template-archive" aria-label="テンプレートのアーカイブ確認">
      <h2>アーカイブ理由</h2>
      <p>新しいイベントの選択肢から外します。既にコピー済みのイベント、過去の版、適用履歴はそのまま残ります。</p>
      <label>理由<select value={reason} onChange={(event) => setReason(event.target.value as (typeof reasonOptions)[number])}>{reasonOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>{reason === "その他" ? "理由（必須）" : "補足（任意）"}<textarea value={detail} maxLength={300} onChange={(event) => setDetail(event.target.value)} /></label>
      <div className="actions"><button type="button" disabled={busy} onClick={archive}>{busy ? "処理中…" : "確認してアーカイブ"}</button><button type="button" className="secondary" disabled={busy} onClick={() => setArchiveId("")}>やめる</button></div>
    </section>}
    {message && <div className={`operation-feedback${error ? " operation-feedback-error" : ""}`} role={error ? "alert" : "status"}><p>{message}</p></div>}
  </div>;
}
