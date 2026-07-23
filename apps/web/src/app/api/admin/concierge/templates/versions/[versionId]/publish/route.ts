import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { conciergeTemplatePayloadSchema, requirePermission, validateConciergeTemplateForPublish } from "@shime/core";
import { auditLogs, conciergeCardAssetVersions, conciergeTemplateVersions, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../../../server/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "concierge:publish");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED" }, { status: 403 });
  const { versionId } = await params;
  const db = getDatabase();
  const rows = await db
    .select()
    .from(conciergeTemplateVersions)
    .where(
      and(
        eq(conciergeTemplateVersions.id, versionId),
        eq(conciergeTemplateVersions.tenantId, session.tenantId),
        eq(conciergeTemplateVersions.status, "draft"),
      ),
    )
    .limit(1);
  const version = rows[0];
  if (!version) return NextResponse.json({ code: "DRAFT_NOT_FOUND" }, { status: 409 });
  const payload = conciergeTemplatePayloadSchema.safeParse(version.payload);
  if (!payload.success) return NextResponse.json({ code: "INVALID_TEMPLATE" }, { status: 409 });
  const issues = validateConciergeTemplateForPublish(payload.data);
  const cardIds = [
    ...new Set(
      payload.data.cardMappings.filter((mapping) => mapping.active).map((mapping) => mapping.cardAssetVersionId),
    ),
  ];
  const cards = cardIds.length
    ? await db
        .select({ id: conciergeCardAssetVersions.id })
        .from(conciergeCardAssetVersions)
        .where(
          and(
            eq(conciergeCardAssetVersions.tenantId, session.tenantId),
            eq(conciergeCardAssetVersions.status, "published"),
            inArray(conciergeCardAssetVersions.id, cardIds),
          ),
        )
    : [];
  if (cards.length !== cardIds.length)
    issues.push({ code: "CARD_MAPPING_INVALID", message: "公開済みでないカード画像が含まれています。" });
  if (issues.length) return NextResponse.json({ code: "PUBLISH_VALIDATION_FAILED", issues }, { status: 409 });
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(conciergeTemplateVersions)
      .set({ status: "archived", archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(conciergeTemplateVersions.tenantId, session.tenantId),
          eq(conciergeTemplateVersions.templateId, version.templateId),
          eq(conciergeTemplateVersions.status, "published"),
        ),
      );
    await tx
      .update(conciergeTemplateVersions)
      .set({ status: "published", publishedAt: now, updatedAt: now })
      .where(
        and(
          eq(conciergeTemplateVersions.id, versionId),
          eq(conciergeTemplateVersions.tenantId, session.tenantId),
          eq(conciergeTemplateVersions.status, "draft"),
        ),
      );
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "concierge.template.version.publish",
      targetType: "concierge_template_version",
      targetId: versionId,
      after: { templateId: version.templateId, version: version.version, status: "published" },
      requestId,
    });
  });
  return NextResponse.json({ data: { id: versionId, status: "published" } });
}
