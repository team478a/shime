import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  requirePermission,
  nextVenueLayoutTemplateVersion,
  validateSeatConfiguration,
  VENUE_LAYOUT_MODULE_KEY,
  VENUE_LAYOUT_SCHEMA_VERSION,
  VENUE_LAYOUT_TEMPLATE_TYPE,
  venueLayoutPayloadSchema,
  venueLayoutTemplateInputSchema,
} from "@shime/core";
import { auditLogs, getDatabase, resourceTemplates } from "@shime/db";
import { requireStaffSession } from "../../../../../server/auth";

function templateKeyForName(name: string): string {
  const normalized = name.normalize("NFKC").trim().toLocaleLowerCase("ja");
  return `venue_${createHash("sha256").update(normalized).digest("hex").slice(0, 32)}`;
}

export async function GET() {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { requirePermission(session.role, "event:write"); } catch { return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }
  const rows = await getDatabase().select().from(resourceTemplates).where(and(
    eq(resourceTemplates.tenantId, session.tenantId),
    eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
    eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
    eq(resourceTemplates.active, true),
  )).orderBy(desc(resourceTemplates.updatedAt));
  const data = rows.flatMap((row) => {
    const payload = venueLayoutPayloadSchema.safeParse(row.payload);
    return payload.success ? [{ id: row.id, name: row.name, version: row.version, payload: payload.data }] : [];
  });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try { requirePermission(session.role, "event:write"); } catch { return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 }); }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED", request_id: requestId }, { status: 403 });
  const parsed = venueLayoutTemplateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  try {
    const seatCount = parsed.data.tables.reduce((total, table) => total + table.seats.length, 0);
    validateSeatConfiguration(parsed.data.tables, seatCount);
  } catch {
    return NextResponse.json({ code: "INVALID_SEAT_CONFIGURATION", request_id: requestId }, { status: 400 });
  }

  const db = getDatabase();
  const templateKey = templateKeyForName(parsed.data.name);
  const payload = { schemaVersion: VENUE_LAYOUT_SCHEMA_VERSION, tables: parsed.data.tables };
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${session.tenantId}:${VENUE_LAYOUT_MODULE_KEY}:${VENUE_LAYOUT_TEMPLATE_TYPE}:${templateKey}`}))`);
    const current = await tx.select({ version: resourceTemplates.version }).from(resourceTemplates).where(and(
      eq(resourceTemplates.tenantId, session.tenantId),
      eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
      eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
      eq(resourceTemplates.templateKey, templateKey),
    )).orderBy(desc(resourceTemplates.version)).limit(1);
    const version = nextVenueLayoutTemplateVersion(current[0]?.version);
    await tx.update(resourceTemplates).set({ active: false, updatedAt: new Date() }).where(and(
      eq(resourceTemplates.tenantId, session.tenantId),
      eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
      eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
      eq(resourceTemplates.templateKey, templateKey),
      eq(resourceTemplates.active, true),
    ));
    const [row] = await tx.insert(resourceTemplates).values({
      tenantId: session.tenantId,
      moduleKey: VENUE_LAYOUT_MODULE_KEY,
      templateType: VENUE_LAYOUT_TEMPLATE_TYPE,
      templateKey,
      name: parsed.data.name,
      version,
      schemaVersion: VENUE_LAYOUT_SCHEMA_VERSION,
      payload,
      active: true,
      createdBy: session.userId,
    }).returning();
    if (!row) throw new Error("RESOURCE_TEMPLATE_CREATE_FAILED");
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "resource_template.venue_layout.version.create",
      targetType: "resource_template",
      targetId: row.id,
      after: { moduleKey: VENUE_LAYOUT_MODULE_KEY, templateType: VENUE_LAYOUT_TEMPLATE_TYPE, templateKey, version, tableCount: parsed.data.tables.length },
      requestId,
    });
    return row;
  });

  return NextResponse.json({ data: { id: created.id, name: created.name, version: created.version, payload } }, { status: 201 });
}
