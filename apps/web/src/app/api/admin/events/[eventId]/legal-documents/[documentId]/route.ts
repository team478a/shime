import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import { auditLogs, events, getDatabase, legalDocuments } from "@shime/db";
import { requireStaffSession } from "../../../../../../../server/auth";
import { withPublishedLegalVersion } from "../../../../../../../server/legal-documents";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), title: z.string().trim().min(1).max(240), body: z.string().trim().min(1).max(50_000) }),
  z.object({ action: z.literal("publish") }),
]);

type Context = { params: Promise<{ eventId: string; documentId: string }> };

export async function PATCH(request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try { requirePermission(session.role, "event:write"); } catch { return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 }); }
  const { eventId, documentId } = await context.params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", field_errors: parsed.error.flatten().fieldErrors, request_id: requestId }, { status: 400 });

  const db = getDatabase();
  const document = (await db.select().from(legalDocuments).where(and(
    eq(legalDocuments.id, documentId),
    eq(legalDocuments.tenantId, session.tenantId),
    eq(legalDocuments.eventId, eventId),
  )).limit(1))[0];
  if (!document) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  if (document.status !== "draft") return NextResponse.json({ code: "DOCUMENT_IMMUTABLE", request_id: requestId }, { status: 409 });

  if (parsed.data.action === "update") {
    const data = parsed.data;
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(legalDocuments).set({ title: data.title, body: data.body, updatedBy: session.userId, updatedAt: new Date() }).where(and(
        eq(legalDocuments.id, documentId),
        eq(legalDocuments.tenantId, session.tenantId),
        eq(legalDocuments.eventId, eventId),
        eq(legalDocuments.status, "draft"),
      )).returning();
      const row = rows[0];
      if (row) await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        eventId,
        action: "legal_document.draft.update",
        targetType: "legal_document",
        targetId: row.id,
        before: { documentType: document.documentType, version: document.version, status: document.status },
        after: { documentType: row.documentType, version: row.version, status: row.status },
        requestId,
      });
      return rows;
    });
    return updated ? NextResponse.json({ data: updated, request_id: requestId }) : NextResponse.json({ code: "CONFLICT", request_id: requestId }, { status: 409 });
  }

  const event = (await db.select().from(events).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId))).limit(1))[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const now = new Date();
  const publishResult = await db.transaction(async (tx) => {
    const rows = await tx.update(legalDocuments).set({ status: "published", publishedAt: now, updatedBy: session.userId, updatedAt: now }).where(and(
      eq(legalDocuments.id, documentId),
      eq(legalDocuments.tenantId, session.tenantId),
      eq(legalDocuments.eventId, eventId),
      eq(legalDocuments.status, "draft"),
    )).returning();
    const row = rows[0];
    if (!row) return { conflict: true as const, rows: [] };
    await tx.update(legalDocuments).set({ status: "retired", updatedBy: session.userId, updatedAt: now }).where(and(
      eq(legalDocuments.tenantId, session.tenantId),
      eq(legalDocuments.eventId, eventId),
      eq(legalDocuments.documentType, document.documentType),
      eq(legalDocuments.status, "published"),
      ne(legalDocuments.id, documentId),
    ));
    await tx.update(events).set({ settings: withPublishedLegalVersion(event.settings, row.documentType, row.version), updatedAt: now }).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)));
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "legal_document.publish",
      targetType: "legal_document",
      targetId: row.id,
      before: { documentType: document.documentType, version: document.version, status: document.status },
      after: { documentType: row.documentType, version: row.version, status: row.status },
      requestId,
    });
    return { conflict: false as const, rows };
  });
  if (publishResult.conflict) return NextResponse.json({ code: "CONFLICT", request_id: requestId }, { status: 409 });
  return NextResponse.json({ data: publishResult.rows[0], request_id: requestId });
}
