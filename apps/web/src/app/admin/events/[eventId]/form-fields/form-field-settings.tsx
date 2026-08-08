"use client";

import { useEffect, useState } from "react";

import { STANDARD_PROFILE_SUPPORT_FORM_FIELDS } from "@shime/core/events/config";
import {
  createMarriageDayFormFields,
  type FormFieldRow,
  type FormFieldTemplate,
  normalizeFormFieldOrder,
} from "./form-field-config";
import { FormFieldEditor } from "./form-field-editor";

export function FormFieldSettings({
  eventId,
  initial,
  templates,
  canManageTemplates,
}: {
  eventId: string;
  initial: FormFieldRow[];
  templates: FormFieldTemplate[];
  canManageTemplates: boolean;
}) {
  const [rows, setRows] = useState<FormFieldRow[]>(initial);
  const [sourceTemplateId, setSourceTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const draftStorageKey = `shime:application-form-draft:${eventId}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(draftStorageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved) as { rows?: FormFieldRow[] };
        if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return;
        setRows(normalizeFormFieldOrder(parsed.rows));
        setHasUnsavedChanges(true);
        setMessage("保存前の入力内容をこの端末から復元しました。");
      } catch {
        window.sessionStorage.removeItem(draftStorageKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify({ rows, savedAt: new Date().toISOString() }));
  }, [draftStorageKey, hasUnsavedChanges, rows]);

  function replaceRows(nextRows: FormFieldRow[]) {
    setRows(normalizeFormFieldOrder(nextRows));
    setHasUnsavedChanges(true);
  }

  function update(index: number, patch: Partial<FormFieldRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    setHasUnsavedChanges(true);
  }

  function move(index: number, direction: -1 | 1) {
    setRows((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      const selected = next[index];
      const displaced = next[destination];
      if (!selected || !displaced) return current;
      next[index] = displaced;
      next[destination] = selected;
      return normalizeFormFieldOrder(next);
    });
    setHasUnsavedChanges(true);
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
    try {
      const response = await fetch(`/api/admin/events/${eventId}/form-fields`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields: body, ...(sourceTemplateId ? { sourceTemplateId } : {}) }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        setMessage(`保存できません: ${result.message ?? result.code ?? "通信エラー"}。入力内容は保持しています。`);
        return;
      }
      setRows(normalizeFormFieldOrder(rows));
      setSourceTemplateId("");
      setHasUnsavedChanges(false);
      window.sessionStorage.removeItem(draftStorageKey);
      setMessage("申込フォーム項目を保存しました。再読み込み後もこの内容が表示されます。");
    } catch {
      setMessage("通信のため保存できませんでした。入力内容はこの端末に保持しています。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
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
              if (selected) replaceRows(selected.rows);
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
              現在の内容を再利用テンプレートとして保存
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
              テンプレートだけを保存
            </button>
          </div>
        )}
      </section>
      {message && <p role="status">{message}</p>}
      <section className="resource-template-picker">
        <h2>明日の婚活イベント用</h2>
        <p>指定された10項目に並べ、マッチングに必要な参加区分を11番目へ残します。</p>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "現在の画面上の項目を、婚活当日用の並びへ置き換えますか？保存するまで本番へ反映されません。",
              )
            ) {
              replaceRows(createMarriageDayFormFields(rows));
              setSourceTemplateId("");
              setMessage("婚活当日用の並びを画面へ反映しました。内容を確認して「申込項目を保存」を押してください。");
            }
          }}
        >
          婚活当日用10項目に並べる
        </button>
      </section>
      {rows.map((row, index) => (
        <FormFieldEditor
          key={`${row.fieldKey}-${index}`}
          row={row}
          index={index}
          count={rows.length}
          onUpdate={(patch) => update(index, patch)}
          onMove={(direction) => move(index, direction)}
          onRemove={() => replaceRows(rows.filter((_, rowIndex) => rowIndex !== index))}
        />
      ))}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setRows((current) => {
              const existing = new Set(current.map((row) => row.fieldKey));
              const additions = STANDARD_PROFILE_SUPPORT_FORM_FIELDS.filter(
                (field) => !existing.has(field.fieldKey),
              ).map((field) => ({ ...field, displayOrder: current.length + 1, options: "" }));
              return [...current, ...additions].map((row, index) => ({ ...row, displayOrder: index + 1 }));
            });
            setHasUnsavedChanges(true);
          }}
        >
          プロフィール・応援5項目を追加
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
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
            ]);
            setHasUnsavedChanges(true);
          }}
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
      {hasUnsavedChanges && (
        <p className="hint">未保存の変更があります。画面を閉じても、この端末内で一時保持します。</p>
      )}
    </section>
  );
}
