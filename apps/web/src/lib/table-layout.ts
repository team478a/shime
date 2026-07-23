import { parse } from "csv-parse/sync";

export type TableLayoutRow = Readonly<{
  tableCode: string;
  capacity: number;
  seats: string;
}>;

export type TableLayoutSource = Readonly<{
  id: string;
  kind: "template" | "event";
  label: string;
  rows: TableLayoutRow[];
  templateId?: string;
  templateName?: string;
}>;

export function templateNameAfterSourceCopy(currentName: string, source: TableLayoutSource): string {
  return source.kind === "template" && source.templateName ? source.templateName : currentName;
}

export type TableLayoutValidation = Readonly<{
  tableCount: number;
  seatCount: number;
  errors: string[];
  warnings: string[];
}>;

export function splitSeatCodes(value: string): string[] {
  return value
    .split(",")
    .map((seatCode) => seatCode.trim())
    .filter(Boolean);
}

export function generateTableLayout(input: {
  prefix: string;
  firstTableNumber: number;
  tableCount: number;
  seatsPerTable: number;
}): TableLayoutRow[] {
  const prefix = input.prefix.trim();
  if (!prefix || prefix.length > 20) throw new Error("テーブル記号は1〜20文字で入力してください。");
  if (!Number.isInteger(input.firstTableNumber) || input.firstTableNumber < 0)
    throw new Error("開始番号は0以上の整数で入力してください。");
  if (!Number.isInteger(input.tableCount) || input.tableCount < 1 || input.tableCount > 200)
    throw new Error("テーブル数は1〜200で入力してください。");
  if (!Number.isInteger(input.seatsPerTable) || input.seatsPerTable < 1 || input.seatsPerTable > 50)
    throw new Error("1卓の席数は1〜50で入力してください。");

  return Array.from({ length: input.tableCount }, (_, tableIndex) => {
    const tableCode = `${prefix}${String(input.firstTableNumber + tableIndex).padStart(2, "0")}`;
    return {
      tableCode,
      capacity: input.seatsPerTable,
      seats: Array.from({ length: input.seatsPerTable }, (_, seatIndex) => `${tableCode}-${seatIndex + 1}`).join(", "),
    };
  });
}

export function parseTableLayoutCsv(csv: string): TableLayoutRow[] {
  const records = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
  if (!records.length) throw new Error("CSVにデータ行がありません。");

  const tableByCode = new Map<string, { capacity: number; seats: string[] }>();
  for (const [index, record] of records.entries()) {
    const tableCode = record.table_code?.trim();
    const seatCode = record.seat_code?.trim();
    const capacity = Number(record.capacity);
    if (!tableCode || !seatCode || !Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`${index + 2}行目のtable_code、capacity、seat_codeを確認してください。`);
    }
    const existing = tableByCode.get(tableCode);
    if (existing && existing.capacity !== capacity) throw new Error(`${tableCode}の定員が行によって異なります。`);
    if (existing) existing.seats.push(seatCode);
    else tableByCode.set(tableCode, { capacity, seats: [seatCode] });
  }

  return [...tableByCode.entries()].map(([tableCode, table]) => ({
    tableCode,
    capacity: table.capacity,
    seats: table.seats.join(", "),
  }));
}

export function validateTableLayout(rows: TableLayoutRow[], eventCapacity: number): TableLayoutValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tableCodes = rows.map((row) => row.tableCode.trim()).filter(Boolean);
  const allSeatCodes = rows.flatMap((row) => splitSeatCodes(row.seats));

  if (!rows.length) errors.push("テーブルを1卓以上登録してください。");
  if (tableCodes.length !== rows.length) errors.push("テーブルコードを入力してください。");
  if (new Set(tableCodes).size !== tableCodes.length) errors.push("テーブルコードが重複しています。");
  if (new Set(allSeatCodes).size !== allSeatCodes.length) errors.push("席コードが重複しています。");
  rows.forEach((row, index) => {
    const seatCount = splitSeatCodes(row.seats).length;
    if (!Number.isInteger(row.capacity) || row.capacity < 1)
      errors.push(`テーブル${index + 1}の定員を確認してください。`);
    if (!seatCount) errors.push(`テーブル${index + 1}に席を1つ以上登録してください。`);
    if (seatCount > row.capacity) errors.push(`${row.tableCode || `テーブル${index + 1}`}の席数が定員を超えています。`);
  });
  if (allSeatCodes.length < eventCapacity)
    warnings.push(`イベント定員${eventCapacity}名に対して、席が${allSeatCodes.length}席です。`);
  if (allSeatCodes.length > eventCapacity)
    warnings.push(`イベント定員${eventCapacity}名を${allSeatCodes.length - eventCapacity}席超えています。`);

  return { tableCount: rows.length, seatCount: allSeatCodes.length, errors: [...new Set(errors)], warnings };
}
