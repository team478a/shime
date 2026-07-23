import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { applicationInputSchema, type ApplicationInput } from "./validation";

export const CSV_COLUMNS = [
  "external_id",
  "full_name",
  "phone",
  "email",
  "birth_date",
  "participant_category",
  "application_status",
] as const;
export type CsvIssue = { column: string; code: string; message: string };
export type ValidatedCsvRow = {
  rowNumber: number;
  level: "valid" | "warning" | "error";
  data: ApplicationInput | null;
  issues: CsvIssue[];
};

export function parseApplicationCsv(content: string): { fileHash: string; rows: ValidatedCsvRow[] } {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: false,
  }) as Record<string, string>[];
  const seen = new Set<string>();
  const rows = records.map((record, index): ValidatedCsvRow => {
    const issues: CsvIssue[] = [];
    for (const column of CSV_COLUMNS)
      if (!(column in record)) issues.push({ column, code: "MISSING_HEADER", message: `${column} header is required` });
    const externalId = record.external_id?.trim();
    if (externalId && seen.has(externalId))
      issues.push({
        column: "external_id",
        code: "DUPLICATE_IN_FILE",
        message: "external_id is duplicated in this file",
      });
    if (externalId) seen.add(externalId);
    const parsed = applicationInputSchema.safeParse({
      externalId,
      status: record.application_status || "confirmed",
      fullName: record.full_name,
      fullNameKana: record.full_name_kana || undefined,
      phone: record.phone || undefined,
      email: record.email || undefined,
      birthDate: record.birth_date,
      nickname: record.nickname || undefined,
      residenceArea: record.residence_area || undefined,
      participantCategory: record.participant_category,
      notes: record.notes || undefined,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        issues.push({ column: String(issue.path[0] ?? "row"), code: "INVALID_VALUE", message: issue.message });
    return {
      rowNumber: index + 2,
      level: issues.length ? "error" : "valid",
      data: parsed.success ? parsed.data : null,
      issues,
    };
  });
  return { fileHash: createHash("sha256").update(content).digest("hex"), rows };
}
