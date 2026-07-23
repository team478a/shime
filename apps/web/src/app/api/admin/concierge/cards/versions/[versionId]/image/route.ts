import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requirePermission } from "@shime/core";
import { conciergeCardAssetVersions, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../../../server/auth";
import { createConciergeStorageProvider } from "../../../../../../../../server/concierge-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { requirePermission(session.role, "concierge:manage"); } catch { return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }
  const { versionId } = await params;
  const row = (await getDatabase().select({ objectKey: conciergeCardAssetVersions.storageObjectKey }).from(conciergeCardAssetVersions).where(and(
    eq(conciergeCardAssetVersions.id, versionId),
    eq(conciergeCardAssetVersions.tenantId, session.tenantId),
  )).limit(1))[0];
  if (!row) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const url = await createConciergeStorageProvider().createSignedReadUrl(row.objectKey, 300);
  return NextResponse.redirect(url, { status: 307 });
}
