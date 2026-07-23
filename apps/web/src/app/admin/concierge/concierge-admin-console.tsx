"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CONCIERGE_TEMPLATE_SCHEMA_VERSION,
  createEmptyConciergeTemplate,
  type ConciergeTemplatePayload,
} from "@shime/core/concierge";

type VersionStatus = "draft" | "published" | "archived";
export type ConciergeAdminTemplate = {
  id: string;
  name: string;
  versions: { id: string; version: number; status: VersionStatus; payload: ConciergeTemplatePayload }[];
};
export type ConciergeAdminCard = {
  id: string;
  code: string;
  name: string;
  versions: { id: string; version: number; status: VersionStatus; title: string; message: string; altText: string; width: number; height: number }[];
};

type QuestionDraft = { axisCode: string; prompt: string; supplementalText: string; options: string };
type EmotionDraft = { code: string; label: string; description: string };
type MappingDraft = { cardAssetVersionId: string; emotionCode: string };

const emptyQuestions = (): QuestionDraft[] => Array.from({ length: 4 }, () => ({ axisCode: "", prompt: "", supplementalText: "", options: "" }));
const emptyEmotions = (): EmotionDraft[] => Array.from({ length: 8 }, () => ({ code: "", label: "", description: "" }));

function rowsFromPayload(payload: ConciergeTemplatePayload) {
  const questions = emptyQuestions();
  payload.questions.forEach((question, index) => {
    if (questions[index]) questions[index] = {
      axisCode: question.axisCode,
      prompt: question.prompt,
      supplementalText: question.supplementalText,
      options: question.options.map((option) => `${option.code}:${option.label}`).join("\n"),
    };
  });
  const emotions = emptyEmotions();
  payload.emotions.forEach((emotion, index) => {
    if (emotions[index]) emotions[index] = { code: emotion.code, label: emotion.label, description: emotion.description };
  });
  return {
    questions,
    emotions,
    mappings: payload.cardMappings.map((mapping) => ({ cardAssetVersionId: mapping.cardAssetVersionId, emotionCode: mapping.emotionCode })),
  };
}

export function ConciergeAdminConsole({ initialTemplates, initialCards, canPublish }: {
  initialTemplates: ConciergeAdminTemplate[];
  initialCards: ConciergeAdminCard[];
  canPublish: boolean;
}) {
  const [templates] = useState(initialTemplates);
  const [cards] = useState(initialCards);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [payload, setPayload] = useState<ConciergeTemplatePayload>(createEmptyConciergeTemplate());
  const [questions, setQuestions] = useState<QuestionDraft[]>(emptyQuestions);
  const [emotions, setEmotions] = useState<EmotionDraft[]>(emptyEmotions);
  const [mappings, setMappings] = useState<MappingDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const publishedCards = useMemo(() => cards.flatMap((card) => card.versions
    .filter((version) => version.status === "published")
    .map((version) => ({ ...version, assetName: card.name, assetCode: card.code }))), [cards]);

  function loadVersion(template: ConciergeAdminTemplate, version: ConciergeAdminTemplate["versions"][number]) {
    const rows = rowsFromPayload(version.payload);
    setTemplateId(template.id);
    setTemplateName(template.name);
    setPayload(version.payload);
    setQuestions(rows.questions);
    setEmotions(rows.emotions);
    setMappings(rows.mappings);
    setMessage(version.status === "published" ? "公開版を基に新しい下書き版を作成します。" : "下書きを編集できます。");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload(): ConciergeTemplatePayload {
    return {
      ...payload,
      schemaVersion: CONCIERGE_TEMPLATE_SCHEMA_VERSION,
      questions: questions.flatMap((question, index) => {
        if (!question.axisCode.trim() && !question.prompt.trim()) return [];
        return [{
          axisCode: question.axisCode.trim(),
          prompt: question.prompt.trim(),
          supplementalText: question.supplementalText.trim(),
          required: true,
          displayOrder: index + 1,
          options: question.options.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, optionIndex) => {
            const separator = line.indexOf(":");
            return {
              code: (separator >= 0 ? line.slice(0, separator) : `option_${optionIndex + 1}`).trim(),
              label: (separator >= 0 ? line.slice(separator + 1) : line).trim(),
              displayOrder: optionIndex + 1,
            };
          }),
        }];
      }),
      emotions: emotions.flatMap((emotion, index) => !emotion.code.trim() && !emotion.label.trim() ? [] : [{
        code: emotion.code.trim(),
        label: emotion.label.trim(),
        description: emotion.description.trim(),
        displayOrder: index + 1,
        active: true,
      }]),
      cardMappings: mappings.filter((mapping) => mapping.cardAssetVersionId && mapping.emotionCode.trim()).map((mapping, index) => ({
        cardAssetVersionId: mapping.cardAssetVersionId,
        emotionCode: mapping.emotionCode.trim(),
        displayOrder: index + 1,
        active: true,
      })),
    };
  }

  async function saveTemplate() {
    setBusy(true);
    setMessage("");
    const draft = buildPayload();
    const selectedDraft = templates.find((template) => template.id === templateId)?.versions.find((version) => version.status === "draft");
    const response = selectedDraft
      ? await fetch(`/api/admin/concierge/templates/versions/${selectedDraft.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) })
      : await fetch("/api/admin/concierge/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: templateName, templateId: templateId || undefined, payload: draft }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(`保存できませんでした（${result.code ?? response.status}）。入力コードは半角小文字・数字・_を使用してください。`);
      return;
    }
    setMessage("下書きを保存しました。公開済み版には影響していません。");
    window.location.reload();
  }

  async function publish(kind: "templates" | "cards", versionId: string) {
    if (!window.confirm("内容を確認し、この版を公開しますか？公開中の旧版はアーカイブされます。")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/concierge/${kind}/versions/${versionId}/publish`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.issues?.map((issue: { message: string }) => issue.message).join(" ") ?? `公開できませんでした（${result.code ?? response.status}）。`);
      return;
    }
    setMessage("公開しました。");
    window.location.reload();
  }

  async function uploadCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/concierge/cards", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(`画像を保存できませんでした（${result.code ?? response.status}）。JPEG/PNG/WebP、5MB以下、512px以上を確認してください。`);
      return;
    }
    setMessage("安全化した画像を新しい下書き版として保存しました。");
    window.location.reload();
  }

  function moveMapping(index: number, offset: -1 | 1) {
    setMappings((current) => {
      const targetIndex = index + offset;
      const item = current[index];
      const target = current[targetIndex];
      if (!item || !target) return current;
      const next = [...current];
      next[index] = target;
      next[targetIndex] = item;
      return next;
    });
  }

  return <div className="admin-stack">
    <section className="panel wide">
      <p className="eyebrow">CONCIERGE PHASE 1A</p>
      <h1>診断・カード管理</h1>
      <p>現在は設定・版管理のみです。外部AI接続と参加者向け診断はまだ有効化されません。正式文言が未確定でも下書き保存できます。</p>
      {message && <p role="status" className="notice">{message}</p>}
    </section>

    <section className="panel wide">
      <h2>診断テンプレートの下書き</h2>
      <label>テンプレート名<input value={templateName} maxLength={160} onChange={(event) => setTemplateName(event.target.value)} placeholder="例：標準診断テンプレート" /></label>
      <div className="settings-grid">
        <label>画面タイトル<input value={payload.copy.pageTitle} onChange={(event) => setPayload((current) => ({ ...current, copy: { ...current.copy, pageTitle: event.target.value } }))} /></label>
        <label>完了見出し<input value={payload.copy.completionTitle} onChange={(event) => setPayload((current) => ({ ...current, copy: { ...current.copy, completionTitle: event.target.value } }))} /></label>
      </div>
      <label>導入文<textarea rows={3} value={payload.copy.intro} onChange={(event) => setPayload((current) => ({ ...current, copy: { ...current.copy, intro: event.target.value } }))} /></label>
      <label>案内文<textarea rows={3} value={payload.copy.instructions} onChange={(event) => setPayload((current) => ({ ...current, copy: { ...current.copy, instructions: event.target.value } }))} /></label>
      <label>完了本文<textarea rows={3} value={payload.copy.completionBody} onChange={(event) => setPayload((current) => ({ ...current, copy: { ...current.copy, completionBody: event.target.value } }))} /></label>
      <div className="settings-grid">
        {(["startButton", "nextButton", "backButton", "completeButton"] as const).map((key) => <label key={key}>{({ startButton: "開始ボタン", nextButton: "次へ", backButton: "戻る", completeButton: "完了ボタン" })[key]}<input value={payload.copy[key]} onChange={(event) => setPayload((current) => ({ ...current, copy: { ...current.copy, [key]: event.target.value } }))} /></label>)}
      </div>
      <fieldset>
        <legend>保護対象メッセージ</legend>
        <p>本文は自由編集できません。開発側が承認した固定文キーだけを選択します。</p>
        {([
          ["auth_required", "認証が必要"],
          ["permission_denied", "権限がありません"],
          ["identity_verification_required", "本人確認が必要"],
          ["personal_data_notice", "個人情報の案内"],
          ["ai_consent_required", "AI利用同意"],
          ["system_error", "システムエラー"],
        ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={payload.protectedMessageKeys.includes(key)} onChange={(event) => setPayload((current) => ({
          ...current,
          protectedMessageKeys: event.target.checked
            ? [...current.protectedMessageKeys, key]
            : current.protectedMessageKeys.filter((item) => item !== key),
        }))} />{label}</label>)}
      </fieldset>
      <h3>設問・4分析軸</h3>
      {questions.map((question, index) => <fieldset key={index}>
        <legend>分析軸 {index + 1}</legend>
        <div className="settings-grid">
          <label>軸コード<input value={question.axisCode} placeholder="axis_code" onChange={(event) => setQuestions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, axisCode: event.target.value } : row))} /></label>
          <label>設問<input value={question.prompt} onChange={(event) => setQuestions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, prompt: event.target.value } : row))} /></label>
        </div>
        <label>補足文<input value={question.supplementalText} onChange={(event) => setQuestions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, supplementalText: event.target.value } : row))} /></label>
        <label>選択肢（1行に code:表示名）<textarea rows={4} value={question.options} placeholder={"yes:はい\nno:いいえ"} onChange={(event) => setQuestions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, options: event.target.value } : row))} /></label>
      </fieldset>)}
      <h3>8つの感情コード</h3>
      {emotions.map((emotion, index) => <fieldset key={index}>
        <legend>感情 {index + 1}</legend>
        <div className="settings-grid">
          <label>コード<input value={emotion.code} placeholder="emotion_code" onChange={(event) => setEmotions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, code: event.target.value } : row))} /></label>
          <label>表示名<input value={emotion.label} onChange={(event) => setEmotions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} /></label>
        </div>
        <label>説明<input value={emotion.description} onChange={(event) => setEmotions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} /></label>
      </fieldset>)}
      <h3>カード割当</h3>
      {mappings.map((mapping, index) => <div className="settings-grid" key={index}>
        <label>公開済みカード<select value={mapping.cardAssetVersionId} onChange={(event) => setMappings((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, cardAssetVersionId: event.target.value } : row))}><option value="">選択</option>{publishedCards.map((card) => <option key={card.id} value={card.id}>{card.assetCode} / {card.title} v{card.version}</option>)}</select></label>
        <label>感情コード<input value={mapping.emotionCode} onChange={(event) => setMappings((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, emotionCode: event.target.value } : row))} /></label>
        <div className="actions">
          <button type="button" className="secondary" disabled={index === 0} onClick={() => moveMapping(index, -1)}>上へ</button>
          <button type="button" className="secondary" disabled={index === mappings.length - 1} onClick={() => moveMapping(index, 1)}>下へ</button>
          <button type="button" className="secondary" onClick={() => setMappings((current) => current.filter((_, rowIndex) => rowIndex !== index))}>割当を削除</button>
        </div>
      </div>)}
      <button type="button" className="secondary" onClick={() => setMappings((current) => [...current, { cardAssetVersionId: "", emotionCode: "" }])}>カード割当を追加</button>
      <h3>AIレポート固定文（生成はPhase 2）</h3>
      <div className="settings-grid">
        <label>タイトル<input value={payload.reportCopy.title} onChange={(event) => setPayload((current) => ({ ...current, reportCopy: { ...current.reportCopy, title: event.target.value } }))} /></label>
        <label>見出し<input value={payload.reportCopy.heading} onChange={(event) => setPayload((current) => ({ ...current, reportCopy: { ...current.reportCopy, heading: event.target.value } }))} /></label>
      </div>
      {(["fixedText", "disclaimer", "guidance"] as const).map((key) => <label key={key}>{({ fixedText: "固定文", disclaimer: "免責文", guidance: "案内文" })[key]}<textarea rows={3} value={payload.reportCopy[key]} onChange={(event) => setPayload((current) => ({ ...current, reportCopy: { ...current.reportCopy, [key]: event.target.value } }))} /></label>)}
      <div className="actions"><button type="button" disabled={busy || !templateName.trim()} onClick={saveTemplate}>{busy ? "処理中…" : "下書きを保存"}</button><a className="button-link secondary" href="/admin">管理トップへ</a></div>
    </section>

    <section className="panel wide">
      <h2>保存済みテンプレート</h2>
      {templates.length === 0 && <p>まだありません。</p>}
      {templates.map((template) => <article className="admin-list-card" key={template.id}><h3>{template.name}</h3>{template.versions.map((version) => <div className="actions" key={version.id}><span>v{version.version} / {version.status}</span><button type="button" className="secondary" onClick={() => loadVersion(template, version)}>{version.status === "draft" ? "編集" : "この版から新規版"}</button>{version.status === "draft" && canPublish && <button type="button" disabled={busy} onClick={() => publish("templates", version.id)}>公開</button>}</div>)}</article>)}
    </section>

    <section className="panel wide">
      <h2>カード画像</h2>
      <p>画像差し替えも既存版の上書きではなく、新しい版として保存します。</p>
      <form className="settings-form" onSubmit={uploadCard}>
        <label>差し替え元（新規なら未選択）<select name="assetId"><option value="">新しいカード</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.code} / {card.name}</option>)}</select></label>
        <div className="settings-grid"><label>カードコード<input name="code" required pattern="[a-z0-9_]{2,80}" /></label><label>管理名<input name="name" required maxLength={160} /></label></div>
        <label>表示タイトル<input name="title" required maxLength={160} /></label>
        <label>メッセージ<textarea name="message" rows={3} maxLength={4000} /></label>
        <label>画像の代替テキスト<input name="altText" required maxLength={500} /></label>
        <label>画像（JPEG / PNG / WebP、5MB以下、512×512px以上）<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        <button disabled={busy}>{busy ? "処理中…" : "安全化して下書き版を作成"}</button>
      </form>
      {cards.map((card) => <article className="admin-list-card" key={card.id}><h3>{card.code} / {card.name}</h3>{card.versions.map((version) => <div key={version.id}><p>v{version.version} / {version.status} / {version.title} / {version.width}×{version.height}px</p><div className="actions"><a className="button-link secondary" href={`/api/admin/concierge/cards/versions/${version.id}/image`} target="_blank">画像確認</a>{version.status === "draft" && canPublish && <button type="button" disabled={busy} onClick={() => publish("cards", version.id)}>公開</button>}</div></div>)}</article>)}
    </section>
  </div>;
}
