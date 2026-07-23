import { createHash, randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  EVENT_CONFIGURATION_MODULE_KEY,
  EVENT_CONFIGURATION_SCHEMA_VERSION,
  eventConfigurationTemplateInputSchema,
  nextEventConfigurationTemplateVersion,
  requirePermission,
} from "@shime/core";
import { auditLogs, getDatabase, resourceTemplates } from "@shime/db";

import { requireStaffSession } from "../../../../../server/auth";

function templateKeyForName(templateType: string, name: string) {
  const normalized = name.normalize("NFKC").trim().toLocaleLowerCase("ja");
  return `${templateType}_${createHash("sha256").update(normalized).digest("hex").slice(0, 32)}`;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try {
    requirePermission(session.role, "event:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  }
  if (session.eventId)
    return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED", request_id: requestId }, { status: 403 });

  const parsed = eventConfigurationTemplateInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { code: "INVALID_INPUT", issues: parsed.error.issues.map((issue) => issue.message), request_id: requestId },
      { status: 400 },
    );

  const db = getDatabase();
  const templateKey = templateKeyForName(parsed.data.templateType, parsed.data.name);
  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${session.tenantId}:${EVENT_CONFIGURATION_MODULE_KEY}:${parsed.data.templateType}:${templateKey}`}))`,
    );
    const current = await tx
      .select({ version: resourceTemplates.version })
      .from(resourceTemplates)
      .where(
        and(
          eq(resourceTemplates.tenantId, session.tenantId),
          eq(resourceTemplates.moduleKey, EVENT_CONFIGURATION_MODULE_KEY),
          eq(resourceTemplates.templateType, parsed.data.templateType),
          eq(resourceTemplates.templateKey, templateKey),
        ),
      )
      .orderBy(desc(resourceTemplates.version))
      .limit(1);
    const version = nextEventConfigurationTemplateVersion(current[0]?.version);
    await tx
      .update(resourceTemplates)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(resourceTemplates.tenantId, session.tenantId),
          eq(resourceTemplates.moduleKey, EVENT_CONFIGURATION_MODULE_KEY),
          eq(resourceTemplates.templateType, parsed.data.templateType),
          eq(resourceTemplates.templateKey, templateKey),
          eq(resourceTemplates.active, true),
        ),
      );
    const [row] = await tx
      .insert(resourceTemplates)
      .values({
        tenantId: session.tenantId,
        moduleKey: EVENT_CONFIGURATION_MODULE_KEY,
        templateType: parsed.data.templateType,
        templateKey,
        name: parsed.data.name,
        version,
        schemaVersion: EVENT_CONFIGURATION_SCHEMA_VERSION,
        payload: parsed.data.payload,
        active: true,
        createdBy: session.userId,
      })
      .returning();
    if (!row) throw new Error("RESOURCE_TEMPLATE_CREATE_FAILED");
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: `resource_template.${parsed.data.templateType}.version.create`,
      targetType: "resource_template",
      targetId: row.id,
      after: {
        moduleKey: EVENT_CONFIGURATION_MODULE_KEY,
        templateType: parsed.data.templateType,
        templateKey,
        version,
      },
      requestId,
    });
    return row;
  });

  return NextResponse.json(
    { data: { id: created.id, name: created.name, version: created.version, templateType: created.templateType } },
    { status: 201 },
  );
}
