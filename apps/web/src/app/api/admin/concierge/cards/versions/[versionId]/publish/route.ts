import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requirePermission } from "@shime/core";
import { auditLogs, conciergeCardAssetVersions, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../../../server/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { requirePermission(session.role, "concierge:publish"); } catch { return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED" }, { status: 403 });
  const { versionId } = await params;
  const db = getDatabase();
  const target = await db.select().from(conciergeCardAssetVersions).where(and(
    eq(conciergeCardAssetVersions.id, versionId),
    eq(conciergeCardAssetVersions.tenantId, session.tenantId),
    eq(conciergeCardAssetVersions.status, "draft"),
  )).limit(1);
  const version = target[0];
  if (!version) return NextResponse.json({ code: "DRAFT_NOT_FOUND" }, { status: 409 });
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(conciergeCardAssetVersions).set({ status: "archived", archivedAt: now, updatedAt: now }).where(and(
      eq(conciergeCardAssetVersions.tenantId, session.tenantId),
      eq(conciergeCardAssetVersions.assetId, version.assetId),
      eq(conciergeCardAssetVersions.status, "published"),
    ));
    await tx.update(conciergeCardAssetVersions).set({ status: "published", publishedAt: now, updatedAt: now }).where(and(
      eq(conciergeCardAssetVersions.id, versionId),
      eq(conciergeCardAssetVersions.tenantId, session.tenantId),
      eq(conciergeCardAssetVersions.status, "draft"),
    ));
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "concierge.card.version.publish",
      targetType: "concierge_card_asset_version",
      targetId: versionId,
      after: { assetId: version.assetId, version: version.version, status: "published" },
      requestId,
    });
  });
  return NextResponse.json({ data: { id: versionId, status: "published" } });
}
