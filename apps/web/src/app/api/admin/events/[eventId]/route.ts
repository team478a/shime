import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEventTransition, eventDeletionBlocker, requirePermission, type EventStatus } from "@shime/core";
import {
  applicationImports,
  applications,
  auditLogs,
  consents,
  eventDreamSettings,
  eventFormFields,
  eventQuestionnaires,
  eventSeats,
  eventTables,
  events,
  getDatabase,
  legalDocuments,
  notifications,
  participants,
  resultConfirmations,
  seatingRuns,
  staffRoles,
} from "@shime/db";
import { requireStaffSession } from "../../../../../server/auth";
import {
  eventSettingsFields,
  getEventConfigurationReadiness,
  getEventConfigurationStatus,
  mergeEventSettings,
} from "../../../../../server/event-settings";

const updateInput = z
  .object({
    name: z.string().trim().min(1).max(240).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    venueName: z.string().trim().max(240).nullable().optional(),
    venueAddress: z.string().trim().max(1000).nullable().optional(),
    capacity: z.number().int().positive().max(10_000).optional(),
    applicationOpensAt: z.coerce.date().nullable().optional(),
    applicationClosesAt: z.coerce.date().nullable().optional(),
    dreamRegistrationMode: z.enum(["required_private_allowed", "optional"]).optional(),
    preferenceMode: z.enum(["mutual_up_to_2", "first_choice_only", "ranked_up_to_3"]).optional(),
    preferenceOpensAt: z.coerce.date().nullable().optional(),
    preferenceClosesAt: z.coerce.date().nullable().optional(),
    allowMultipleMatches: z.boolean().optional(),
    status: z
      .enum([
        "draft",
        "accepting",
        "registration_closed",
        "checkin_open",
        "in_progress",
        "preference_open",
        "preference_closed",
        "result_confirmed",
        "completed",
      ])
      .optional(),
    reason: z.string().trim().max(1000).optional(),
    ...eventSettingsFields,
  })
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "At least one change is required",
  });

type Context = { params: Promise<{ eventId: string }> };
const deleteInput = z.object({ confirmCode: z.string().trim().min(1), reason: z.string().trim().min(3).max(1000) });

export async function GET(_request: Request, context: Context) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const { eventId } = await context.params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const rows = await getDatabase()
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  return rows[0]
    ? NextResponse.json({
        data: { ...rows[0], configuration: await getEventConfigurationReadiness(session.tenantId, eventId, rows[0]) },
      })
    : NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
}

export async function PATCH(request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try {
    requirePermission(session.role, "event:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  }
  const { eventId } = await context.params;
  if (session.eventId && session.eventId !== eventId)
    return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { code: "INVALID_INPUT", field_errors: parsed.error.flatten().fieldErrors, request_id: requestId },
      { status: 400 },
    );
  const db = getDatabase();
  const currentRows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  const current = currentRows[0];
  if (!current) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const {
    participantCategories,
    participantNumber,
    conversationRounds,
    cardSetCode,
    retentionDays,
    eventTermsVersion,
    privacyVersion,
    contactExchangeMode,
    reason,
    ...eventChanges
  } = parsed.data;
  const settings = mergeEventSettings(current.settings, {
    participantCategories,
    participantNumber,
    conversationRounds,
    cardSetCode,
    retentionDays,
    eventTermsVersion,
    privacyVersion,
    contactExchangeMode,
  });
  const candidate = {
    name: eventChanges.name ?? current.name,
    startsAt: eventChanges.startsAt ?? current.startsAt,
    endsAt: eventChanges.endsAt === undefined ? current.endsAt : eventChanges.endsAt,
    venueName: eventChanges.venueName === undefined ? current.venueName : eventChanges.venueName,
    venueAddress: eventChanges.venueAddress === undefined ? current.venueAddress : eventChanges.venueAddress,
    applicationOpensAt:
      eventChanges.applicationOpensAt === undefined ? current.applicationOpensAt : eventChanges.applicationOpensAt,
    applicationClosesAt:
      eventChanges.applicationClosesAt === undefined ? current.applicationClosesAt : eventChanges.applicationClosesAt,
    preferenceOpensAt:
      eventChanges.preferenceOpensAt === undefined ? current.preferenceOpensAt : eventChanges.preferenceOpensAt,
    preferenceClosesAt:
      eventChanges.preferenceClosesAt === undefined ? current.preferenceClosesAt : eventChanges.preferenceClosesAt,
    capacity: eventChanges.capacity ?? current.capacity,
    settings,
  };
  const baseConfiguration = getEventConfigurationStatus(candidate);
  if (baseConfiguration.issues.some((issue) => issue.kind === "invalid")) {
    return NextResponse.json(
      { code: "INVALID_DATE_RANGE", configuration: baseConfiguration, request_id: requestId },
      { status: 400 },
    );
  }
  const currentConfiguration = await getEventConfigurationReadiness(session.tenantId, eventId, current);
  const configuration = await getEventConfigurationReadiness(session.tenantId, eventId, candidate);
  if (eventChanges.status) {
    if (eventChanges.status === "accepting" && !configuration.complete) {
      return NextResponse.json(
        { code: "CONFIGURATION_INCOMPLETE", configuration, request_id: requestId },
        { status: 409 },
      );
    }
    try {
      authorizeEventTransition({
        from: current.status as EventStatus,
        to: eventChanges.status,
        role: session.role,
        ...(reason ? { reason } : {}),
      });
    } catch (error) {
      return NextResponse.json(
        {
          code: "INVALID_STATE_TRANSITION",
          message: error instanceof Error ? error.message : "Invalid transition",
          request_id: requestId,
        },
        { status: 409 },
      );
    }
  }
  if (
    ["preference_open", "preference_closed", "result_confirmed", "completed"].includes(current.status) &&
    eventChanges.preferenceMode &&
    eventChanges.preferenceMode !== current.preferenceMode
  ) {
    return NextResponse.json({ code: "PREFERENCE_MODE_LOCKED", request_id: requestId }, { status: 409 });
  }
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(events)
      .set({ ...eventChanges, settings, updatedAt: new Date() })
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .returning();
    const row = rows[0];
    if (row)
      await tx.insert(auditLogs).values({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        eventId,
        action: "event.update",
        targetType: "event",
        targetId: eventId,
        before: { status: current.status, configurationComplete: currentConfiguration.complete },
        after: {
          status: row.status,
          configurationComplete: configuration.complete,
          changedFields: Object.keys(parsed.data).filter((key) => key !== "reason"),
        },
        reason,
        requestId,
      });
    return rows;
  });
  return NextResponse.json({ data: updated ? { ...updated, configuration } : updated, request_id: requestId });
}

export async function DELETE(request: Request, context: Context) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", request_id: requestId }, { status: 401 });
  try {
    requirePermission(session.role, "event:delete");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", request_id: requestId }, { status: 403 });
  }
  const parsed = deleteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ code: "CONFIRMATION_REQUIRED", request_id: requestId }, { status: 400 });
  const { eventId } = await context.params;
  const db = getDatabase();
  const current = (
    await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1)
  )[0];
  if (!current) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const operationalChecks = await Promise.all([
    db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.tenantId, session.tenantId), eq(applications.eventId, eventId)))
      .limit(1),
    db
      .select({ id: applicationImports.id })
      .from(applicationImports)
      .where(and(eq(applicationImports.tenantId, session.tenantId), eq(applicationImports.eventId, eventId)))
      .limit(1),
    db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)))
      .limit(1),
    db
      .select({ id: consents.id })
      .from(consents)
      .where(and(eq(consents.tenantId, session.tenantId), eq(consents.eventId, eventId)))
      .limit(1),
    db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.tenantId, session.tenantId), eq(notifications.eventId, eventId)))
      .limit(1),
    db
      .select({ id: seatingRuns.id })
      .from(seatingRuns)
      .where(and(eq(seatingRuns.tenantId, session.tenantId), eq(seatingRuns.eventId, eventId)))
      .limit(1),
    db
      .select({ id: resultConfirmations.id })
      .from(resultConfirmations)
      .where(and(eq(resultConfirmations.tenantId, session.tenantId), eq(resultConfirmations.eventId, eventId)))
      .limit(1),
  ]);
  const blocker = eventDeletionBlocker({
    status: current.status,
    confirmCode: parsed.data.confirmCode,
    eventCode: current.code,
    hasOperationalData: operationalChecks.some((rows) => rows.length > 0),
  });
  if (blocker) return NextResponse.json({ code: blocker, request_id: requestId }, { status: 409 });
  await db.transaction(async (tx) => {
    await tx
      .delete(eventDreamSettings)
      .where(and(eq(eventDreamSettings.tenantId, session.tenantId), eq(eventDreamSettings.eventId, eventId)));
    await tx
      .delete(eventQuestionnaires)
      .where(and(eq(eventQuestionnaires.tenantId, session.tenantId), eq(eventQuestionnaires.eventId, eventId)));
    await tx
      .delete(eventFormFields)
      .where(and(eq(eventFormFields.tenantId, session.tenantId), eq(eventFormFields.eventId, eventId)));
    await tx
      .delete(legalDocuments)
      .where(and(eq(legalDocuments.tenantId, session.tenantId), eq(legalDocuments.eventId, eventId)));
    await tx.delete(eventSeats).where(and(eq(eventSeats.tenantId, session.tenantId), eq(eventSeats.eventId, eventId)));
    await tx
      .delete(eventTables)
      .where(and(eq(eventTables.tenantId, session.tenantId), eq(eventTables.eventId, eventId)));
    await tx.delete(staffRoles).where(and(eq(staffRoles.tenantId, session.tenantId), eq(staffRoles.eventId, eventId)));
    await tx
      .update(auditLogs)
      .set({ eventId: null })
      .where(and(eq(auditLogs.tenantId, session.tenantId), eq(auditLogs.eventId, eventId)));
    await tx.delete(events).where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)));
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId: null,
      action: "event.delete",
      targetType: "event",
      targetId: eventId,
      before: { code: current.code, name: current.name, status: current.status },
      reason: parsed.data.reason,
      requestId,
    });
  });
  return NextResponse.json({ ok: true, request_id: requestId });
}
