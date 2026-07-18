"use client";

import { useState, type FormEvent } from "react";

type Initial = {
  registrationMode: "required_private_allowed" | "optional";
  aiEnabled: boolean;
  aiTimeoutMs: number;
  fallbackBridgeTemplate: string;
  fallbackCandidates: string[];
  projectConsentVersion: string;
  cardSetCode: string;
  cardSetName: string;
  cardSetVersion: number;
  cardsText: string;
};

export function DreamSettingsForm({ eventId, initial }: { eventId: string; initial: Initial }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const candidates = [String(form.get("candidate1")), String(form.get("candidate2")), String(form.get("candidate3"))];
    const cards = String(form.get("cards"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name = "", imageKey = "", description = ""] = line.split("|");
        return { name: name.trim(), imageKey: imageKey.trim() || null, description: description.trim() || null };
      });
    const body = {
      registrationMode: form.get("registrationMode"),
      aiEnabled: form.get("aiEnabled") === "on",
      aiTimeoutMs: Number(form.get("aiTimeoutMs")),
      fallbackBridgeTemplate: form.get("fallbackBridgeTemplate"),
      fallbackCandidates: candidates,
      projectConsentVersion: String(form.get("projectConsentVersion") || "") || null,
      cardSet: {
        code: form.get("cardSetCode"),
        name: form.get("cardSetName"),
        version: Number(form.get("cardSetVersion")),
        cards,
      },
    };
    const response = await fetch(`/api/admin/events/${eventId}/dream-settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setMessage(response.ok ? "Dream設定を保存しました。" : "保存できませんでした。入力内容をご確認ください。");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="admin-stack">
      <section className="panel wide">
        <h1>Dream設定</h1>
        <label>夢登録方式<select name="registrationMode" defaultValue={initial.registrationMode}><option value="required_private_allowed">必須（非公開可）</option><option value="optional">任意（スキップ可）</option></select></label>
        <label><input name="aiEnabled" type="checkbox" defaultChecked={initial.aiEnabled} /> AI文章生成を有効化する</label>
        <p className="hint">外部接続・運用設定でOpenAIを有効化してください。接続失敗やタイムアウト時は固定文へ自動で戻ります。</p>
        <label>AIタイムアウト（ms）<input name="aiTimeoutMs" type="number" min="1000" max="10000" defaultValue={initial.aiTimeoutMs} /></label>
        <label>プロジェクト同意文書版<input name="projectConsentVersion" defaultValue={initial.projectConsentVersion} /></label>
      </section>
      <section className="panel wide">
        <h2>固定文フォールバック</h2>
        <label>橋渡し文テンプレート<textarea name="fallbackBridgeTemplate" defaultValue={initial.fallbackBridgeTemplate} /><small>{"{card} と {wish} を利用できます"}</small></label>
        {initial.fallbackCandidates.map((candidate, index) => <label key={index}>夢候補 {index + 1}<input name={`candidate${index + 1}`} defaultValue={candidate} /></label>)}
      </section>
      <section className="panel wide">
        <h2>感情カードセット</h2>
        <label>コード<input name="cardSetCode" defaultValue={initial.cardSetCode} required /></label>
        <label>名称<input name="cardSetName" defaultValue={initial.cardSetName} required /></label>
        <label>バージョン<input name="cardSetVersion" type="number" min="1" defaultValue={initial.cardSetVersion} /></label>
        <label>カード（1行1枚：名称 | 画像キー | 説明）<textarea name="cards" rows={10} defaultValue={initial.cardsText} required /></label>
        <button disabled={busy}>{busy ? "保存中…" : "Dream設定を保存"}</button>
        {message && <p role="status">{message}</p>}
      </section>
    </form>
  );
}
