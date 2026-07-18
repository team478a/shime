"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import {
  generateTableLayout,
  parseTableLayoutCsv,
  splitSeatCodes,
  templateNameAfterSourceCopy,
  validateTableLayout,
  type TableLayoutSource,
  type TableLayoutRow,
} from "../../../../../lib/table-layout";

function responseMessage(code?: string): string {
  if (code === "SEAT_CONFIGURATION_IN_USE") return "配置案が作成済みのため変更できません。配置案を作る前にテーブル設定を確定してください。";
  if (code === "INVALID_SEAT_CONFIGURATION" || code === "INVALID_INPUT") return "入力内容を確認してください。";
  if (code === "FORBIDDEN") return "この操作を行う権限がありません。";
  return "保存できませんでした。通信状態を確認してください。";
}

export function TableSettingsForm({
  eventId,
  eventCapacity,
  initial,
  layoutSources,
  canCreateTemplate,
  initialTemplateName,
}: {
  eventId: string;
  eventCapacity: number;
  initial: TableLayoutRow[];
  layoutSources: TableLayoutSource[];
  canCreateTemplate: boolean;
  initialTemplateName: string;
}) {
  const [rows, setRows] = useState<TableLayoutRow[]>(initial.length ? initial : [{ tableCode: "T01", capacity: 2, seats: "T01-1, T01-2" }]);
  const [sources, setSources] = useState<TableLayoutSource[]>(layoutSources);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [sourceTemplateId, setSourceTemplateId] = useState<string | undefined>();
  const [templateName, setTemplateName] = useState(initialTemplateName);
  const [prefix, setPrefix] = useState("T");
  const [firstTableNumber, setFirstTableNumber] = useState(1);
  const [tableCount, setTableCount] = useState(10);
  const [seatsPerTable, setSeatsPerTable] = useState(5);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<"" | "event" | "template">("");
  const validation = useMemo(() => validateTableLayout(rows, eventCapacity), [rows, eventCapacity]);

  function update(index: number, patch: Partial<TableLayoutRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function replaceRows(next: TableLayoutRow[], source: string, templateId?: string) {
    if (rows.some((row) => row.tableCode || row.seats) && !window.confirm(`現在の入力内容を${source}の内容で置き換えますか？まだ保存はされません。`)) return false;
    setRows(next);
    setSourceTemplateId(templateId);
    setError(false);
    setMessage(`${source}から${next.length}卓を作成しました。座席図を確認して保存してください。`);
    return true;
  }

  function applyGenerator() {
    try {
      replaceRows(generateTableLayout({ prefix, firstTableNumber, tableCount, seatsPerTable }), "自動生成");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "自動生成できませんでした。");
    }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = parseTableLayoutCsv(await file.text());
      replaceRows(imported, "CSV");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "CSVを読み込めませんでした。");
    } finally {
      input.value = "";
    }
  }

  function serializedTables() {
    return rows.map((row, index) => ({
      tableCode: row.tableCode.trim(),
      capacity: Number(row.capacity),
      displayOrder: index + 1,
      seats: splitSeatCodes(row.seats).map((seatCode) => ({ seatCode })),
    }));
  }

  function applySource() {
    const source = sources.find((item) => item.id === selectedSourceId);
    if (!source) {
      setError(true);
      setMessage("コピー元を選択してください。");
      return;
    }
    if (replaceRows(source.rows, source.label, source.templateId)) setTemplateName(templateNameAfterSourceCopy(templateName, source));
  }

  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) {
      setError(true);
      setMessage("テンプレート名を入力してください。");
      return;
    }
    if (validation.errors.length) {
      setError(true);
      setMessage("テンプレート保存前に赤色の確認事項を修正してください。");
      return;
    }
    if (!window.confirm(`現在の${validation.tableCount}卓・${validation.seatCount}席を「${name}」としてテナント共通テンプレートに保存しますか？同名の場合は新しい版になります。`)) return;
    setBusy("template");
    setError(false);
    setMessage("会場レイアウトテンプレートを保存しています…");
    try {
      const response = await fetch("/api/admin/resource-templates/venue-layouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, tables: serializedTables() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data) {
        setError(true);
        setMessage(responseMessage(result?.code));
        return;
      }
      const latestResponse = await fetch("/api/admin/resource-templates/venue-layouts");
      const latest = await latestResponse.json().catch(() => null);
      if (latestResponse.ok && Array.isArray(latest?.data)) {
        const templateSources: TableLayoutSource[] = latest.data.map((item: { id: string; name: string; version: number; payload: { tables: Array<{ tableCode: string; capacity: number; displayOrder: number; seats: Array<{ seatCode: string }> }> } }) => ({
          id: `template:${item.id}`,
          kind: "template",
          label: `${item.name}（v${item.version}）`,
          templateId: item.id,
          templateName: item.name,
          rows: [...item.payload.tables].sort((left, right) => left.displayOrder - right.displayOrder).map((table) => ({ tableCode: table.tableCode, capacity: table.capacity, seats: table.seats.map((seat) => seat.seatCode).join(", ") })),
        }));
        setSources((current) => [...templateSources, ...current.filter((source) => source.kind === "event")]);
      }
      setSelectedSourceId(`template:${result.data.id}`);
      setMessage(`「${result.data.name}」v${result.data.version}を保存しました。今後のイベントで再利用できます。`);
    } catch {
      setError(true);
      setMessage("テンプレートを保存できませんでした。通信状態を確認してください。");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (validation.errors.length) {
      setError(true);
      setMessage("保存前に赤色の確認事項を修正してください。");
      return;
    }
    const warningText = validation.warnings.length ? `\n\n注意: ${validation.warnings.join(" ")}` : "";
    if (!window.confirm(`${validation.tableCount}卓・${validation.seatCount}席を保存します。既存のテーブル設定は置き換わります。${warningText}`)) return;
    setBusy("event");
    setError(false);
    setMessage("テーブル・席を保存しています…");
    const body = { tables: serializedTables(), sourceTemplateId };
    try {
      const response = await fetch(`/api/admin/events/${eventId}/tables`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(true);
        setMessage(responseMessage(result?.code));
        return;
      }
      setMessage(`テーブル・席を保存しました（${validation.tableCount}卓・${validation.seatCount}席）。`);
    } catch {
      setError(true);
      setMessage("保存できませんでした。通信状態を確認してください。");
    } finally {
      setBusy("");
    }
  }

  return <div className="admin-stack table-setup-page"><section className="panel wide">
    <p className="eyebrow">TABLES &amp; SEATS</p>
    <h1>テーブル・席の初期設定</h1>
    <p>会場ごとに構成を作成します。自動生成またはCSVで下書きを作り、座席図を確認してから保存してください。</p>

    <div className="summary table-layout-summary" aria-label="テーブル設定件数">
      <span>イベント定員 {eventCapacity}名</span><span>テーブル {validation.tableCount}卓</span><span>席 {validation.seatCount}席</span>
    </div>

    <details className="table-setup-tool" open={sources.length > 0}>
      <summary>会場テンプレート・過去イベントからコピー</summary>
      <div className="table-setup-tool-body">
        <p className="hint">コピー後にこのイベント用として調整できます。コピー元のテンプレートや過去イベントは変更されません。</p>
        {sourceTemplateId && <p className="operation-feedback">会場テンプレートを元に編集中です。イベントへ保存した時点の最終構成と元版を履歴に残します。</p>}
        {sources.length ? <div className="table-layout-source-controls">
          <label>コピー元<select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)}>
            <option value="">選択してください</option>
            <optgroup label="会場テンプレート">{sources.filter((source) => source.kind === "template").map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</optgroup>
            <optgroup label="過去イベント">{sources.filter((source) => source.kind === "event").map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</optgroup>
          </select></label>
          <button type="button" className="secondary" disabled={!selectedSourceId || Boolean(busy)} onClick={applySource}>選択した構成をコピー</button>
        </div> : <p className="participant-empty">利用できるテンプレートまたは過去イベントはまだありません。</p>}
        {canCreateTemplate && <div className="table-template-save">
          <label>テンプレート名<input value={templateName} maxLength={160} onChange={(event) => setTemplateName(event.target.value)} placeholder="例: 市民ホールA 50名配置" /></label>
          <button type="button" className="secondary" disabled={Boolean(busy) || validation.errors.length > 0} onClick={saveTemplate}>{busy === "template" ? "保存中…" : "現在の構成をテンプレート保存"}</button>
        </div>}
      </div>
    </details>

    <details className="table-setup-tool" open={!initial.length}>
      <summary>かんたん自動生成</summary>
      <div className="table-setup-tool-body">
        <p className="hint">全テーブルが同じ席数の会場に向いています。</p>
        <div className="settings-grid table-generator-grid">
          <label>テーブル記号<input value={prefix} maxLength={20} onChange={(event) => setPrefix(event.target.value)} placeholder="T" /></label>
          <label>開始番号<input type="number" min="0" value={firstTableNumber} onChange={(event) => setFirstTableNumber(Number(event.target.value))} /></label>
          <label>テーブル数<input type="number" min="1" max="200" value={tableCount} onChange={(event) => setTableCount(Number(event.target.value))} /></label>
          <label>1卓の席数<input type="number" min="1" max="50" value={seatsPerTable} onChange={(event) => setSeatsPerTable(Number(event.target.value))} /></label>
        </div>
        <button type="button" className="secondary" onClick={applyGenerator}>この条件で座席を作成</button>
      </div>
    </details>

    <details className="table-setup-tool">
      <summary>CSVから読み込む</summary>
      <div className="table-setup-tool-body">
        <p className="hint">1席を1行として、table_code・capacity・seat_codeを入力します。</p>
        <div className="actions">
          <a className="button-link secondary" href="/templates/TABLE_IMPORT_TEMPLATE.csv" download>CSVひな形を取得</a>
          <label className="button-link secondary table-csv-file">CSVファイルを選択<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label>
        </div>
      </div>
    </details>

    {(validation.errors.length > 0 || validation.warnings.length > 0) && <section className={validation.errors.length ? "configuration-incomplete" : "table-layout-warning"} aria-label="保存前の確認事項">
      <h2>保存前の確認</h2>
      <ul>{validation.errors.map((item) => <li key={item}>{item}</li>)}{validation.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>}

    <section className="table-layout-preview" aria-label="テーブル配置プレビュー">
      <div><h2>座席図プレビュー</h2><p className="hint">実際の会場内の位置ではなく、各テーブルの席構成を表します。</p></div>
      <div className="table-layout-preview-grid">
        {rows.map((row, index) => <article className="table-layout-preview-card" key={`${row.tableCode}-${index}`}>
          <div className="table-layout-preview-label"><small>TABLE</small><strong>{row.tableCode || `未入力 ${index + 1}`}</strong></div>
          <div className="table-layout-seat-chips">{splitSeatCodes(row.seats).map((seatCode) => <span key={seatCode}>{seatCode}</span>)}</div>
          <small>{splitSeatCodes(row.seats).length}席 / 定員{row.capacity}名</small>
        </article>)}
      </div>
    </section>

    <details className="table-manual-editor" open>
      <summary>テーブルごとの詳細編集</summary>
      <div className="table-manual-editor-body">{rows.map((row, index) => <fieldset key={index}>
        <legend>テーブル {index + 1}</legend>
        <div className="settings-grid"><label>テーブルコード<input value={row.tableCode} onChange={(event) => update(index, { tableCode: event.target.value })} /></label><label>定員<input type="number" min="1" value={row.capacity} onChange={(event) => update(index, { capacity: Number(event.target.value) })} /></label></div>
        <label>席コード<input value={row.seats} onChange={(event) => update(index, { seats: event.target.value })} placeholder="T01-1, T01-2" /></label>
        <button type="button" className="secondary" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>このテーブルを削除</button>
      </fieldset>)}</div>
    </details>

    <div className="actions table-settings-actions">
      <button type="button" className="secondary" onClick={() => setRows((current) => [...current, { tableCode: `T${String(current.length + 1).padStart(2, "0")}`, capacity: 2, seats: "" }])}>テーブルを追加</button>
      <button type="button" disabled={Boolean(busy) || validation.errors.length > 0} onClick={save}>{busy === "event" ? "保存中…" : `テーブル・席を保存（${validation.seatCount}席）`}</button>
      <a className="button-link secondary" href={`/admin/events/${eventId}/setup`}>設定チェックへ戻る</a>
    </div>
    {message && <div className={`operation-feedback${error ? " operation-feedback-error" : ""}`} role={error ? "alert" : "status"} aria-live="polite"><p>{message}</p></div>}
  </section></div>;
}
