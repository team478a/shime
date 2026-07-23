export type CsvValue = string | number | boolean | Date | null | undefined;
export function protectSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
export function createCsv(headers: string[], rows: CsvValue[][]): string {
  const encode = (value: CsvValue) => {
    const raw = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
    const safe = protectSpreadsheetFormula(raw);
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return `\uFEFF${[headers, ...rows].map((row) => row.map(encode).join(",")).join("\r\n")}\r\n`;
}
