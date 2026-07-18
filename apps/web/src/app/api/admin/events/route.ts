import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultEventFormFields, requirePermission } from "@shime/core";
import { auditLogs, eventFormFields, events, getDatabase } from "@shime/db";
import { requireStaffSession } from "../../../../server/auth";
import { eventSettingsFields, getEventConfigurationReadiness, getEventConfigurationStatus, mergeEventSettings } from "../../../../server/event-settings";

const eventInput = z.object({
  code: z.string().regex(/^[a-z0-9-]{3,80}$/),
  name: z.string().trim().min(1).max(240),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  venueName: z.string().trim().min(1).max(240).nullable().optional(),
  venueAddress: z.string().trim().min(1).max(1000).nullable().optional(),
  capacity: z.number().int().positive().max(10_000),
  applicationOpensAt: z.coerce.date().nullable().optional(),
  applicationClosesAt: z.coerce.date().nullable().optional(),
  dreamRegistrationMode: z.enum(["required_private_allowed", "optional"]),
  preferenceMode: z.enum(["mutual_up_to_2", "first_choice_only", "ranked_up_to_3"]),
  preferenceOpensAt: z.coerce.date().nullable().optional(),
  preferenceClosesAt: z.coerce.date().nullable().optional(),
  allowMultipleMatches: z.boolean().default(false),
  ...eventSettingsFields,
});

export async function GET() {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const rows = await getDatabase().select().from(events).where(eq(events.tenantId, session.tenantId));
  return NextResponse.json({ data: await Promise.all(rows.map(async (event) => ({ ...event, configuration: await getEventConfigurationReadiness(session.tenantId, event.id, event) }))) });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try { requirePermission(session.role, "event:write"); } catch { return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 }); }
  const parsed = eventInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", field_errors: parsed.error.flatten().fieldErrors, request_id: requestId }, { status: 400 });
  const db = getDatabase();
  const existing = await db.select({ id: events.id }).from(events).where(and(eq(events.tenantId, session.tenantId), eq(events.code, parsed.data.code))).limit(1);
  if (existing[0]) return NextResponse.json({ code: "EVENT_CODE_EXISTS", request_id: requestId }, { status: 409 });
  const {
    participantCategories, participantNumber, conversationRounds, cardSetCode, retentionDays,
    eventTermsVersion, privacyVersion, contactExchangeMode, ...eventData
  } = parsed.data;
  const settings = mergeEventSettings({}, {
    participantCategories, participantNumber, conversationRounds, cardSetCode, retentionDays,
    eventTermsVersion, privacyVersion, contactExchangeMode,
  });
  const candidate = {
    ...eventData,
    endsAt: eventData.endsAt ?? null,
    venueName: eventData.venueName ?? null,
    venueAddress: eventData.venueAddress ?? null,
    applicationOpensAt: eventData.applicationOpensAt ?? null,
    applicationClosesAt: eventData.applicationClosesAt ?? null,
    preferenceOpensAt: eventData.preferenceOpensAt ?? null,
    preferenceClosesAt: eventData.preferenceClosesAt ?? null,
    settings,
  };
  const configuration = getEventConfigurationStatus(candidate);
  if (configuration.issues.some((issue) => issue.kind === "invalid")) {
    return NextResponse.json({ code: "INVALID_DATE_RANGE", configuration, request_id: requestId }, { status: 400 });
  }
  const [created] = await db.transaction(async (tx) => {
    const createdRows = await tx.insert(events).values({ tenantId: session.tenantId, status: "draft", ...eventData, settings }).returning();
    const row = createdRows[0];
    if (row) {
      await tx.insert(eventFormFields).values(defaultEventFormFields.map((field) => ({ ...field, tenantId: session.tenantId, eventId: row.id })));
      await tx.insert(auditLogs).values({ tenantId: session.tenantId, actorUserId: session.userId, eventId: row.id, action: "event.create", targetType: "event", targetId: row.id, after: { code: row.code, status: row.status }, requestId });
    }
    return createdRows;
  });
  const readiness = created ? await getEventConfigurationReadiness(session.tenantId, created.id, created) : configuration;
  return NextResponse.json({ data: created ? { ...created, configuration: readiness } : created, request_id: requestId }, { status: 201 });
}
