import type { FormFieldRequirement, FormFieldRow, FormFieldType } from "./form-field-config";

export function FormFieldEditor({
  row,
  index,
  count,
  onUpdate,
  onMove,
  onRemove,
}: {
  row: FormFieldRow;
  index: number;
  count: number;
  onUpdate: (patch: Partial<FormFieldRow>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset>
      <legend>項目 {index + 1}</legend>
      <div className="settings-grid">
        <label>
          項目キー
          <input
            value={row.fieldKey}
            pattern="[a-z0-9_]{2,80}"
            onChange={(event) => onUpdate({ fieldKey: event.target.value })}
          />
        </label>
        <label>
          表示名
          <input value={row.label} onChange={(event) => onUpdate({ label: event.target.value })} />
        </label>
        <label>
          入力種類
          <select value={row.type} onChange={(event) => onUpdate({ type: event.target.value as FormFieldType })}>
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
            onChange={(event) => onUpdate({ requirement: event.target.value as FormFieldRequirement })}
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
          <input value={row.options} onChange={(event) => onUpdate({ options: event.target.value })} />
        </label>
      )}
      <div className="actions">
        <button type="button" className="secondary" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑ 上へ
        </button>
        <button type="button" className="secondary" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓ 下へ
        </button>
        <button type="button" className="secondary" onClick={onRemove}>
          項目を削除
        </button>
      </div>
    </fieldset>
  );
}
