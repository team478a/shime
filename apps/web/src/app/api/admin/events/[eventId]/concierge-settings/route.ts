import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { conciergeTemplatePayloadSchema, requirePermission, validateConciergeTemplateForPublish } from "@shime/core";
import { auditLogs, conciergeCardAssetVersions, conciergeTemplateVersions, eventConciergeSnapshots, events, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../../../server/auth";

const inputSchema = z.object({ templateVersionId: z.string().uuid() });

export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try { requirePermission(session.role, "concierge:manage"); } catch { return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "EVENT_SCOPE_MISMATCH" }, { status: 403 });
  const db = getDatabase();
  const [event, version] = await Promise.all([
    db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId))).limit(1),
    db.select().from(conciergeTemplateVersions).where(and(
      eq(conciergeTemplateVersions.id, parsed.data.templateVersionId),
      eq(conciergeTemplateVersions.tenantId, session.tenantId),
      eq(conciergeTemplateVersions.status, "published"),
    )).limit(1),
  ]);
  const publishedVersion = version[0];
  if (!event[0] || !publishedVersion) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const payload = conciergeTemplatePayloadSchema.safeParse(publishedVersion.payload);
  if (!payload.success || validateConciergeTemplateForPublish(payload.data).length) {
    return NextResponse.json({ code: "PUBLISHED_TEMPLATE_INVALID" }, { status: 409 });
  }
  const cardIds = [...new Set(payload.data.cardMappings.filter((mapping) => mapping.active).map((mapping) => mapping.cardAssetVersionId))];
  const cardVersions = cardIds.length ? await db.select({
    id: conciergeCardAssetVersions.id,
    assetId: conciergeCardAssetVersions.assetId,
    version: conciergeCardAssetVersions.version,
    title: conciergeCardAssetVersions.title,
    message: conciergeCardAssetVersions.message,
    altText: conciergeCardAssetVersions.altText,
    storageObjectKey: conciergeCardAssetVersions.storageObjectKey,
    mimeType: conciergeCardAssetVersions.mimeType,
    contentHash: conciergeCardAssetVersions.contentHash,
    width: conciergeCardAssetVersions.width,
    height: conciergeCardAssetVersions.height,
  }).from(conciergeCardAssetVersions).where(and(
    eq(conciergeCardAssetVersions.tenantId, session.tenantId),
    inArray(conciergeCardAssetVersions.id, cardIds),
  )) : [];
  if (cardVersions.length !== cardIds.length) return NextResponse.json({ code: "CARD_VERSION_NOT_FOUND" }, { status: 409 });
  const snapshot = {
    schemaVersion: 1,
    template: payload.data,
    cards: [...cardVersions].sort((left, right) => left.id.localeCompare(right.id)),
  };
  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const [saved] = await db.transaction(async (tx) => {
    const rows = await tx.insert(eventConciergeSnapshots).values({
      tenantId: session.tenantId,
      eventId,
      templateVersionId: publishedVersion.id,
      templateVersion: publishedVersion.version,
      snapshot,
      snapshotHash,
      enabled: false,
      appliedBy: session.userId,
    }).onConflictDoUpdate({
      target: [eventConciergeSnapshots.tenantId, eventConciergeSnapshots.eventId],
      set: {
        templateVersionId: publishedVersion.id,
        templateVersion: publishedVersion.version,
        snapshot,
        snapshotHash,
        enabled: false,
        appliedBy: session.userId,
        appliedAt: new Date(),
      },
    }).returning();
    if (rows[0]) await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "concierge.event_snapshot.apply",
      targetType: "event_concierge_snapshot",
      targetId: rows[0].id,
      after: { templateVersionId: publishedVersion.id, templateVersion: publishedVersion.version, snapshotHash, enabled: false },
      requestId,
    });
    return rows;
  });
  return NextResponse.json({ data: saved });
}
