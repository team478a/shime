import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CONCIERGE_MODULE_KEY,
  CONCIERGE_TEMPLATE_SCHEMA_VERSION,
  conciergeTemplatePayloadSchema,
  requirePermission,
} from "@shime/core";
import { auditLogs, conciergeTemplates, conciergeTemplateVersions, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../server/auth";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  templateId: z.string().uuid().optional(),
  payload: conciergeTemplatePayloadSchema,
});

function templateKeyForName(name: string) {
  return `concierge_${createHash("sha256").update(name.normalize("NFKC").trim().toLocaleLowerCase("ja")).digest("hex").slice(0, 32)}`;
}

export async function GET() {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "concierge:manage");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED" }, { status: 403 });
  const db = getDatabase();
  const templates = await db
    .select()
    .from(conciergeTemplates)
    .where(
      and(eq(conciergeTemplates.tenantId, session.tenantId), eq(conciergeTemplates.moduleKey, CONCIERGE_MODULE_KEY)),
    )
    .orderBy(desc(conciergeTemplates.updatedAt));
  const versions = await db
    .select()
    .from(conciergeTemplateVersions)
    .where(eq(conciergeTemplateVersions.tenantId, session.tenantId))
    .orderBy(desc(conciergeTemplateVersions.version));
  return NextResponse.json({
    data: templates.map((template) => ({
      ...template,
      versions: versions.filter((version) => version.templateId === template.id),
    })),
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try {
    requirePermission(session.role, "concierge:manage");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  }
  if (session.eventId)
    return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED", request_id: requestId }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { code: "INVALID_INPUT", issues: parsed.error.issues.map((issue) => issue.message), request_id: requestId },
      { status: 400 },
    );
  const db = getDatabase();
  const created = await db
    .transaction(async (tx) => {
      const templateKey = templateKeyForName(parsed.data.name);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${session.tenantId}:${CONCIERGE_MODULE_KEY}:${parsed.data.templateId ?? templateKey}`}))`,
      );
      let template = parsed.data.templateId
        ? (
            await tx
              .select()
              .from(conciergeTemplates)
              .where(
                and(
                  eq(conciergeTemplates.id, parsed.data.templateId),
                  eq(conciergeTemplates.tenantId, session.tenantId),
                  eq(conciergeTemplates.moduleKey, CONCIERGE_MODULE_KEY),
                ),
              )
              .limit(1)
          )[0]
        : undefined;
      if (parsed.data.templateId && !template) throw new Error("TEMPLATE_NOT_FOUND");
      if (!template) {
        [template] = await tx
          .insert(conciergeTemplates)
          .values({
            tenantId: session.tenantId,
            moduleKey: CONCIERGE_MODULE_KEY,
            templateKey,
            name: parsed.data.name,
            createdBy: session.userId,
          })
          .returning();
      }
      if (!template) throw new Error("TEMPLATE_CREATE_FAILED");
      const latest = await tx
        .select({ version: conciergeTemplateVersions.version })
        .from(conciergeTemplateVersions)
        .where(
          and(
            eq(conciergeTemplateVersions.tenantId, session.tenantId),
            eq(conciergeTemplateVersions.templateId, template.id),
          ),
        )
        .orderBy(desc(conciergeTemplateVersions.version))
        .limit(1);
      const [version] = await tx
        .insert(conciergeTemplateVersions)
        .values({
          tenantId: session.tenantId,
          templateId: template.id,
          version: (latest[0]?.version ?? 0) + 1,
          schemaVersion: CONCIERGE_TEMPLATE_SCHEMA_VERSION,
          status: "draft",
          payload: parsed.data.payload,
          createdBy: session.userId,
        })
        .returning();
      if (!version) throw new Error("VERSION_CREATE_FAILED");
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "concierge.template.version.create",
        targetType: "concierge_template_version",
        targetId: version.id,
        after: { templateId: template.id, version: version.version, status: "draft" },
        requestId,
      });
      return { template, version };
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "TEMPLATE_NOT_FOUND") return null;
      throw error;
    });
  if (!created) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  return NextResponse.json({ data: created }, { status: 201 });
}
