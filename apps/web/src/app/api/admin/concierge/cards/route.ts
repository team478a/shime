import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CONCIERGE_MODULE_KEY, requirePermission } from "@shime/core";
import { auditLogs, conciergeCardAssets, conciergeCardAssetVersions, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../server/auth";
import { ConciergeImageValidationError, sanitizeConciergeCardImage } from "../../../../../server/concierge-card-image";
import { createConciergeStorageProvider } from "../../../../../server/concierge-storage";

const fieldsSchema = z.object({
  assetId: z.string().uuid().optional(),
  code: z.string().trim().regex(/^[a-z0-9_]{2,80}$/),
  name: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().max(4_000),
  altText: z.string().trim().min(1).max(500),
});

export async function GET() {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { requirePermission(session.role, "concierge:manage"); } catch { return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }
  const db = getDatabase();
  const assets = await db.select().from(conciergeCardAssets).where(and(
    eq(conciergeCardAssets.tenantId, session.tenantId),
    eq(conciergeCardAssets.moduleKey, CONCIERGE_MODULE_KEY),
  )).orderBy(desc(conciergeCardAssets.updatedAt));
  const versions = await db.select().from(conciergeCardAssetVersions).where(
    eq(conciergeCardAssetVersions.tenantId, session.tenantId),
  ).orderBy(desc(conciergeCardAssetVersions.version));
  return NextResponse.json({ data: assets.map((asset) => ({
    ...asset,
    versions: versions.filter((version) => version.assetId === asset.id),
  })) });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try { requirePermission(session.role, "concierge:manage"); } catch { return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 }); }
  if (session.eventId) return NextResponse.json({ code: "TENANT_SCOPE_REQUIRED", request_id: requestId }, { status: 403 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ code: "INVALID_MULTIPART", request_id: requestId }, { status: 400 });
  const parsed = fieldsSchema.safeParse({
    assetId: form.get("assetId") || undefined,
    code: form.get("code"),
    name: form.get("name"),
    title: form.get("title"),
    message: form.get("message"),
    altText: form.get("altText"),
  });
  const file = form.get("image");
  if (!parsed.success || !(file instanceof File)) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  let image;
  try {
    image = await sanitizeConciergeCardImage({
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredMimeType: file.type,
      fileName: file.name,
    });
  } catch (error) {
    if (error instanceof ConciergeImageValidationError) return NextResponse.json({ code: error.code, request_id: requestId }, { status: 400 });
    throw error;
  }
  const db = getDatabase();
  const duplicate = await db.select({ id: conciergeCardAssetVersions.id }).from(conciergeCardAssetVersions).where(and(
    eq(conciergeCardAssetVersions.tenantId, session.tenantId),
    eq(conciergeCardAssetVersions.contentHash, image.contentHash),
  )).limit(1);
  if (duplicate[0]) return NextResponse.json({ code: "IMAGE_DUPLICATE", duplicateVersionId: duplicate[0].id, request_id: requestId }, { status: 409 });
  let asset = parsed.data.assetId ? (await db.select().from(conciergeCardAssets).where(and(
    eq(conciergeCardAssets.id, parsed.data.assetId),
    eq(conciergeCardAssets.tenantId, session.tenantId),
    eq(conciergeCardAssets.moduleKey, CONCIERGE_MODULE_KEY),
  )).limit(1))[0] : undefined;
  if (parsed.data.assetId && !asset) return NextResponse.json({ code: "ASSET_NOT_FOUND", request_id: requestId }, { status: 404 });
  const assetId = asset?.id ?? randomUUID();
  const latest = asset ? await db.select({ version: conciergeCardAssetVersions.version }).from(conciergeCardAssetVersions).where(and(
    eq(conciergeCardAssetVersions.tenantId, session.tenantId),
    eq(conciergeCardAssetVersions.assetId, asset.id),
  )).orderBy(desc(conciergeCardAssetVersions.version)).limit(1) : [];
  const versionNumber = (latest[0]?.version ?? 0) + 1;
  const objectKey = `tenants/${session.tenantId}/modules/${CONCIERGE_MODULE_KEY}/cards/${assetId}/v${versionNumber}/${image.contentHash}.webp`;
  await createConciergeStorageProvider().uploadImmutable({ objectKey, bytes: image.bytes, contentType: image.mimeType });
  const created = await db.transaction(async (tx) => {
    if (!asset) {
      [asset] = await tx.insert(conciergeCardAssets).values({
        id: assetId,
        tenantId: session.tenantId,
        moduleKey: CONCIERGE_MODULE_KEY,
        code: parsed.data.code,
        name: parsed.data.name,
        createdBy: session.userId,
      }).returning();
    }
    if (!asset) throw new Error("ASSET_CREATE_FAILED");
    const [version] = await tx.insert(conciergeCardAssetVersions).values({
      tenantId: session.tenantId,
      assetId: asset.id,
      version: versionNumber,
      status: "draft",
      title: parsed.data.title,
      message: parsed.data.message,
      altText: parsed.data.altText,
      storageObjectKey: objectKey,
      mimeType: image.mimeType,
      byteSize: image.byteSize,
      width: image.width,
      height: image.height,
      pixelCount: image.pixelCount,
      contentHash: image.contentHash,
      createdBy: session.userId,
    }).returning();
    if (!version) throw new Error("ASSET_VERSION_CREATE_FAILED");
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "concierge.card.version.create",
      targetType: "concierge_card_asset_version",
      targetId: version.id,
      after: { assetId: asset.id, version: version.version, status: "draft", mimeType: image.mimeType, width: image.width, height: image.height, byteSize: image.byteSize, contentHash: image.contentHash },
      requestId,
    });
    return { asset, version };
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
