import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { applicationDiff, parseApplicationCsv, requirePermission } from "@shime/core";
import { applicationImportRows, applicationImports, applications, events, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../server/auth";
import { storeImportOriginal } from "../../../../../../server/import-storage";

type Context = { params: Promise<{ eventId: string }> };
export async function POST(request: Request, context: Context) {
  const session = await requireStaffSession().catch(() => null); if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { requirePermission(session.role, "application:import"); } catch { return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }
  const { eventId } = await context.params; if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const db = getDatabase(); const event = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId))).limit(1); if (!event[0]) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const form = await request.formData(); const file = form.get("file"); const mode = form.get("mode") === "partial" ? "partial" : "all";
  if (!(file instanceof File) || file.size > 10_000_000) return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer()); let validation; try { validation = parseApplicationCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return NextResponse.json({ code: "INVALID_CSV" }, { status: 400 }); }
  const externalIds = validation.rows.flatMap((row) => row.data?.externalId ? [row.data.externalId] : []); const existingRows = externalIds.length ? await db.select().from(applications).where(and(eq(applications.tenantId, session.tenantId), eq(applications.eventId, eventId), inArray(applications.externalId, externalIds))) : []; const existingById = new Map(existingRows.map((row) => [row.externalId, row]));
  for (const row of validation.rows) { const existing = row.data?.externalId ? existingById.get(row.data.externalId) : undefined; if (existing && row.data) { const changed = applicationDiff(existing, row.data); if (changed.length) { row.level = "warning"; row.issues.push(...changed.map((column) => ({ column, code: "VALUE_WILL_CHANGE", message: `${column} will be updated` }))); } } }
  const importId = randomUUID(); const originalFileKey = await storeImportOriginal({ tenantId: session.tenantId, eventId, importId, bytes }).catch(() => null); if (!originalFileKey) return NextResponse.json({ code: "STORAGE_FAILED" }, { status: 503 });
  const counts = { success: validation.rows.filter((row) => row.level === "valid").length, warning: validation.rows.filter((row) => row.level === "warning").length, error: validation.rows.filter((row) => row.level === "error").length };
  await db.transaction(async (tx) => { await tx.insert(applicationImports).values({ id: importId, tenantId: session.tenantId, eventId, originalFileKey, originalFileHash: validation.fileHash, status: "validated", mode, totalRows: validation.rows.length, successRows: counts.success, warningRows: counts.warning, errorRows: counts.error, importedBy: session.userId }); if (validation.rows.length) await tx.insert(applicationImportRows).values(validation.rows.map((row) => ({ tenantId: session.tenantId, eventId, importId, rowNumber: row.rowNumber, level: row.level, externalId: row.data?.externalId, normalizedData: row.data ?? {}, issues: row.issues.map(({ column, code }) => ({ column, code })) }))); });
  return NextResponse.json({ data: { importId, ...counts, rows: validation.rows.map((row) => ({ rowNumber: row.rowNumber, level: row.level, issues: row.issues })) } }, { status: 201 });
}
