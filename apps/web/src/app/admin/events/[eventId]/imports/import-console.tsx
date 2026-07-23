"use client";

import { useState, type FormEvent } from "react";
import {
  buildDuplicateResolutionReason,
  DUPLICATE_MATCH_REASON_LABELS,
  DUPLICATE_REASON_PRESETS,
  DUPLICATE_RESOLUTION_LABELS,
  type DuplicateResolution,
} from "../../../../../lib/duplicate-resolution";

type ImportResult = {
  importId: string;
  success: number;
  warning: number;
  error: number;
  rows: Array<{ rowNumber: number; level: string; issues: Array<{ column: string; code: string }> }>;
};
type Duplicate = { id: string; applicationName: string; candidateName: string; reasons: string[]; resolution: string };

export function ImportConsole({ eventId, initialDuplicates }: { eventId: string; initialDuplicates: Duplicate[] }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [duplicates, setDuplicates] = useState(initialDuplicates);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<DuplicateResolution>("on_hold");
  const [preset, setPreset] = useState("");
  const [note, setNote] = useState("");

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/imports`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const body = await response.json();
      if (!response.ok) setMessage(`検証できませんでした: ${body.code ?? "UNKNOWN"}`);
      else setResult(body.data);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!result || !confirm("検証済みの行を申込みへ反映しますか？")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/imports/${result.importId}/commit`, {
        method: "POST",
      });
      const body = await response.json();
      setMessage(response.ok ? `${body.data.committedRows}件を取り込みました。` : `取込できませんでした: ${body.code}`);
    } finally {
      setBusy(false);
    }
  }
  function openResolution(id: string) {
    setEditingId(id);
    setResolution("on_hold");
    setPreset("");
    setNote("");
    setMessage("");
  }
  async function resolve(item: Duplicate) {
    const reason = buildDuplicateResolutionReason(resolution, preset, note);
    if (!reason) {
      setMessage("判定理由を選択し、「その他」の場合は補足を入力してください。");
      return;
    }
    if (
      !confirm(
        `${item.applicationName}\n候補: ${item.candidateName}\n判定: ${DUPLICATE_RESOLUTION_LABELS[resolution]}\n理由: ${reason}\n\nこの内容で保存しますか？`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/duplicates/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution, reason }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(`判定を保存できませんでした: ${body.code}`);
        return;
      }
      setDuplicates((items) => items.filter((candidate) => candidate.id !== item.id));
      setEditingId(null);
      setMessage(
        `${DUPLICATE_RESOLUTION_LABELS[resolution]}として保存しました。残り ${Math.max(duplicates.length - 1, 0)}件です。`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-stack">
      <section className="panel wide">
        <h1>CSV取込</h1>
        <form onSubmit={validate} className="import-form">
          <label>
            CSVファイル
            <input name="file" type="file" accept=".csv,text/csv" required />
          </label>
          <label>
            エラー時の扱い
            <select name="mode">
              <option value="all">1件でもエラーなら中止</option>
              <option value="partial">正常・警告行だけ取込</option>
            </select>
          </label>
          <button disabled={busy}>{busy ? "処理中…" : "事前検証"}</button>
        </form>
        {message && (
          <div className="operation-feedback" role="status">
            <p>{message}</p>
          </div>
        )}
      </section>
      {result && (
        <section className="panel wide">
          <h2>検証結果</h2>
          <div className="summary">
            <span>正常 {result.success}</span>
            <span>警告 {result.warning}</span>
            <span>エラー {result.error}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>行</th>
                  <th>判定</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.level}</td>
                    <td>{row.issues.map((issue) => `${issue.column}: ${issue.code}`).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={commit} disabled={busy || (result.error > 0 && result.success === 0)}>
            本取込
          </button>
        </section>
      )}
      <section className="panel wide duplicate-review">
        <div className="result-section-heading">
          <div>
            <p className="eyebrow">DUPLICATE REVIEW</p>
            <h2>重複候補</h2>
          </div>
          <span>{duplicates.length}件</span>
        </div>
        <p>一致した項目を確認し、候補を1件ずつ判定します。自動で統合はしません。</p>
        {message && (
          <div className="operation-feedback" role="status">
            <p>{message}</p>
          </div>
        )}
        {duplicates.length === 0 ? (
          <p className="participant-empty">未判定の候補はありません。</p>
        ) : (
          <div className="duplicate-card-list">
            {duplicates.map((item) => (
              <article className="duplicate-card" key={item.id}>
                <div className="duplicate-person-pair">
                  <div>
                    <small>申込者</small>
                    <strong>{item.applicationName}</strong>
                  </div>
                  <span aria-hidden="true">⇄</span>
                  <div>
                    <small>比較候補</small>
                    <strong>{item.candidateName}</strong>
                  </div>
                </div>
                <div className="duplicate-reason-chips" aria-label="検出理由">
                  {item.reasons.map((reason) => (
                    <span key={reason}>{DUPLICATE_MATCH_REASON_LABELS[reason] ?? reason}</span>
                  ))}
                </div>
                {editingId !== item.id ? (
                  <button onClick={() => openResolution(item.id)}>この候補を判定</button>
                ) : (
                  <div className="duplicate-resolution-form">
                    <fieldset>
                      <legend>判定</legend>
                      <div className="duplicate-resolution-options">
                        {(["same_person", "different_person", "on_hold"] as const).map((value) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name={`resolution-${item.id}`}
                              value={value}
                              checked={resolution === value}
                              onChange={() => {
                                setResolution(value);
                                setPreset("");
                              }}
                            />
                            {DUPLICATE_RESOLUTION_LABELS[value]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      判定理由
                      <select value={preset} onChange={(event) => setPreset(event.target.value)}>
                        <option value="">選択してください</option>
                        {DUPLICATE_REASON_PRESETS[resolution].map((reason) => (
                          <option value={reason.value} key={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      補足（任意）
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="必要な場合だけ入力"
                      />
                    </label>
                    <div className="actions">
                      <button disabled={busy} onClick={() => resolve(item)}>
                        {busy ? "保存中…" : "内容を確認して保存"}
                      </button>
                      <button className="secondary" disabled={busy} onClick={() => setEditingId(null)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
