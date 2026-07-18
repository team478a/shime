import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import { auditLogs, events, getDatabase, legalDocuments } from "@shime/db";
import { requireStaffSession } from "../../../../../../server/auth";

const input = z.object({
  documentType: z.enum(["event_terms", "privacy"]),
  version: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(50_000),
});

type Context = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try { requirePermission(session.role, "event:write"); } catch { return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 }); }
  const { eventId } = await context.params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", field_errors: parsed.error.flatten().fieldErrors, request_id: requestId }, { status: 400 });

  const db = getDatabase();
  const event = (await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId))).limit(1))[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });

  try {
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(legalDocuments).values({
        tenantId: session.tenantId,
        eventId,
        ...parsed.data,
        status: "draft",
        createdBy: session.userId,
        updatedBy: session.userId,
      }).returning();
      const row = rows[0];
      if (row) await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        eventId,
        action: "legal_document.draft.create",
        targetType: "legal_document",
        targetId: row.id,
        after: { documentType: row.documentType, version: row.version, status: row.status },
        requestId,
      });
      return rows;
    });
    return NextResponse.json({ data: created, request_id: requestId }, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") return NextResponse.json({ code: "VERSION_EXISTS", request_id: requestId }, { status: 409 });
    throw error;
  }
}
