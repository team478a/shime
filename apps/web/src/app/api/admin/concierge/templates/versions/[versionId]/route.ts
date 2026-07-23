import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { conciergeTemplatePayloadSchema, requirePermission } from "@shime/core";
import { auditLogs, conciergeTemplateVersions, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../../server/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "concierge:manage");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED" }, { status: 403 });
  const parsed = conciergeTemplatePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { code: "INVALID_INPUT", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  const { versionId } = await params;
  const db = getDatabase();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(conciergeTemplateVersions)
      .set({
        payload: parsed.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conciergeTemplateVersions.id, versionId),
          eq(conciergeTemplateVersions.tenantId, session.tenantId),
          eq(conciergeTemplateVersions.status, "draft"),
        ),
      )
      .returning();
    if (rows[0])
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "concierge.template.version.update",
        targetType: "concierge_template_version",
        targetId: versionId,
        after: { status: "draft" },
        requestId,
      });
    return rows;
  });
  return updated
    ? NextResponse.json({ data: updated })
    : NextResponse.json({ code: "DRAFT_NOT_FOUND" }, { status: 409 });
}
