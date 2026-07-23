"use client";

import { useState } from "react";

type FieldType = "text" | "email" | "tel" | "date" | "select" | "checkbox";
type Requirement = "required" | "optional" | "hidden";
type Row = {
  fieldKey: string;
  label: string;
  type: FieldType;
  requirement: Requirement;
  displayOrder: number;
  options: string;
};
type Template = { id: string; name: string; version: number; rows: Row[] };

export function FormFieldSettings({
  eventId,
  initial,
  templates,
  canManageTemplates,
}: {
  eventId: string;
  initial: Row[];
  templates: Template[];
  canManageTemplates: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [sourceTemplateId, setSourceTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
  async function save() {
    setBusy(true);
    setMessage("");
    const body = rows.map((row, index) => ({
      fieldKey: row.fieldKey.trim(),
      label: row.label.trim(),
      type: row.type,
      requirement: row.requirement,
      displayOrder: index + 1,
      validation:
        row.type === "select"
          ? {
              options: row.options
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean),
            }
          : {},
    }));
    const response = await fetch(`/api/admin/events/${eventId}/form-fields`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields: body, ...(sourceTemplateId ? { sourceTemplateId } : {}) }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "申込フォーム項目を保存しました。" : `保存できません: ${result.message ?? result.code}`);
  }
  async function saveAsTemplate() {
    if (!templateName.trim() || busy) return;
    setBusy(true);
    setMessage("");
    const fields = rows.map((row, index) => ({
      fieldKey: row.fieldKey.trim(),
      label: row.label.trim(),
      type: row.type,
      requirement: row.requirement,
      displayOrder: index + 1,
      validation:
        row.type === "select"
          ? {
              options: row.options
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean),
            }
          : {},
    }));
    const response = await fetch("/api/admin/resource-templates/event-configurations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateType: "application_form",
        name: templateName.trim(),
        payload: { schemaVersion: 1, fields },
      }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(
      response.ok
        ? `申込フォームテンプレート v${result.data.version} を保存しました。再読み込み後に選択できます。`
        : `テンプレートを保存できません: ${result.code}`,
    );
  }
  return (
    <section className="panel admin-panel">
      <p className="eyebrow">APPLICATION FORM</p>
      <h1>申込フォーム項目</h1>
      <p>必須保護項目は非表示にできません。連絡先は電話またはメールのどちらかを必須にしてください。</p>
      <section className="resource-template-picker">
        <h2>テンプレートからコピー</h2>
        <p>コピー後はこのイベント専用の設定になります。元テンプレートを変更しても影響しません。</p>
        <label>
          申込フォームテンプレート
          <select
            value={sourceTemplateId}
            onChange={(event) => {
              const selected = templates.find((template) => template.id === event.target.value);
              setSourceTemplateId(event.target.value);
              if (selected) setRows(selected.rows);
            }}
          >
            <option value="">現在のイベント設定を編集</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} (v{template.version})
              </option>
            ))}
          </select>
        </label>
        {canManageTemplates && (
          <div className="template-save-row">
            <label>
              現在の内容をテンプレート保存
              <input
                value={templateName}
                maxLength={160}
                placeholder="例：婚活イベント標準フォーム"
                onChange={(event) => setTemplateName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={busy || !templateName.trim() || rows.length === 0}
              onClick={saveAsTemplate}
            >
              テンプレートとして保存
            </button>
          </div>
        )}
      </section>
      {rows.map((row, index) => (
        <fieldset key={`${row.fieldKey}-${index}`}>
          <legend>項目 {index + 1}</legend>
          <div className="settings-grid">
            <label>
              項目キー
              <input
                value={row.fieldKey}
                pattern="[a-z0-9_]{2,80}"
                onChange={(event) => update(index, { fieldKey: event.target.value })}
              />
            </label>
            <label>
              表示名
              <input value={row.label} onChange={(event) => update(index, { label: event.target.value })} />
            </label>
            <label>
              入力種類
              <select value={row.type} onChange={(event) => update(index, { type: event.target.value as FieldType })}>
                <option value="text">文字</option>
                <option value="email">メール</option>
                <option value="tel">電話</option>
                <option value="date">日付</option>
                <option value="select">選択</option>
                <option value="checkbox">チェック</option>
              </select>
            </label>
            <label>
              必須設定
              <select
                value={row.requirement}
                onChange={(event) => update(index, { requirement: event.target.value as Requirement })}
              >
                <option value="required">必須</option>
                <option value="optional">任意</option>
                <option value="hidden">非表示</option>
              </select>
            </label>
          </div>
          {row.type === "select" && (
            <label>
              選択肢（カンマ区切り）
              <input value={row.options} onChange={(event) => update(index, { options: event.target.value })} />
            </label>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
          >
            項目を削除
          </button>
        </fieldset>
      ))}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                fieldKey: `custom_${current.length + 1}`,
                label: "新しい項目",
                type: "text",
                requirement: "optional",
                displayOrder: current.length + 1,
                options: "",
              },
            ])
          }
        >
          項目を追加
        </button>
        <button type="button" disabled={busy || rows.length === 0} onClick={save}>
          {busy ? "保存中…" : "申込項目を保存"}
        </button>
        <a className="button-link secondary" href="/admin">
          管理トップへ
        </a>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
