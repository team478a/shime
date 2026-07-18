import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { applicationImportRows, applicationImports, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../../server/auth";
type Context = { params: Promise<{ eventId: string; importId: string }> };
export async function GET(_request: Request, context: Context) { const session = await requireStaffSession().catch(() => null); if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }); const { eventId, importId } = await context.params; const db = getDatabase(); const imports = await db.select().from(applicationImports).where(and(eq(applicationImports.id, importId), eq(applicationImports.eventId, eventId), eq(applicationImports.tenantId, session.tenantId))).limit(1); if (!imports[0]) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 }); const rows = await db.select().from(applicationImportRows).where(and(eq(applicationImportRows.importId, importId), eq(applicationImportRows.tenantId, session.tenantId))); return NextResponse.json({ data: { import: imports[0], rows } }); }
