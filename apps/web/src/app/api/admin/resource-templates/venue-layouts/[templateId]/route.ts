import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { nextVenueLayoutTemplateVersion, requirePermission, VENUE_LAYOUT_MODULE_KEY, VENUE_LAYOUT_TEMPLATE_TYPE } from "@shime/core";
import { auditLogs, getDatabase, resourceTemplates } from "@shime/db";

import { requireStaffSession } from "../../../../../../server/auth";

const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive"), reason: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("restore_as_new_version") }),
]);
type Context = { params: Promise<{ templateId: string }> };

export async function PATCH(request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try { requirePermission(session.role, "event:write"); } catch { return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 }); }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED", request_id: requestId }, { status: 403 });
  const parsed = actionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  const { templateId } = await context.params;
  const db = getDatabase();
  const template = (await db.select().from(resourceTemplates).where(and(
    eq(resourceTemplates.id, templateId),
    eq(resourceTemplates.tenantId, session.tenantId),
    eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
    eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
  )).limit(1))[0];
  if (!template) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  if (parsed.data.action === "restore_as_new_version") {
    if (template.active) return NextResponse.json({ code: "SOURCE_VERSION_STILL_ACTIVE", request_id: requestId }, { status: 409 });
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${session.tenantId}:${VENUE_LAYOUT_MODULE_KEY}:${VENUE_LAYOUT_TEMPLATE_TYPE}:${template.templateKey}`}))`);
      const current = await tx.select({ version: resourceTemplates.version }).from(resourceTemplates).where(and(
        eq(resourceTemplates.tenantId, session.tenantId),
        eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
        eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
        eq(resourceTemplates.templateKey, template.templateKey),
      )).orderBy(desc(resourceTemplates.version)).limit(1);
      const version = nextVenueLayoutTemplateVersion(current[0]?.version);
      await tx.update(resourceTemplates).set({ active: false, updatedAt: new Date() }).where(and(
        eq(resourceTemplates.tenantId, session.tenantId),
        eq(resourceTemplates.moduleKey, VENUE_LAYOUT_MODULE_KEY),
        eq(resourceTemplates.templateType, VENUE_LAYOUT_TEMPLATE_TYPE),
        eq(resourceTemplates.templateKey, template.templateKey),
        eq(resourceTemplates.active, true),
      ));
      const [row] = await tx.insert(resourceTemplates).values({
        tenantId: session.tenantId,
        moduleKey: template.moduleKey,
        templateType: template.templateType,
        templateKey: template.templateKey,
        name: template.name,
        version,
        schemaVersion: template.schemaVersion,
        payload: template.payload,
        active: true,
        createdBy: session.userId,
      }).returning();
      if (!row) throw new Error("RESOURCE_TEMPLATE_RESTORE_FAILED");
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "resource_template.venue_layout.version.create_from_history",
        targetType: "resource_template",
        targetId: row.id,
        after: { templateKey: row.templateKey, version, sourceTemplateId: template.id, sourceVersion: template.version },
        requestId,
      });
      return row;
    });
    return NextResponse.json({ data: { id: created.id, name: created.name, version: created.version }, request_id: requestId }, { status: 201 });
  }

  if (!template.active) return NextResponse.json({ code: "ALREADY_ARCHIVED", request_id: requestId }, { status: 409 });
  const archiveReason = parsed.data.reason;

  await db.transaction(async (tx) => {
    await tx.update(resourceTemplates).set({ active: false, updatedAt: new Date() }).where(and(
      eq(resourceTemplates.id, template.id),
      eq(resourceTemplates.tenantId, session.tenantId),
      eq(resourceTemplates.active, true),
    ));
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "resource_template.venue_layout.archive",
      targetType: "resource_template",
      targetId: template.id,
      before: { active: true, templateKey: template.templateKey, version: template.version },
      after: { active: false, templateKey: template.templateKey, version: template.version },
      reason: archiveReason,
      requestId,
    });
  });
  return NextResponse.json({ ok: true, request_id: requestId });
}
