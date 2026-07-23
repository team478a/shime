import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  APPLICATION_FORM_TEMPLATE_TYPE,
  applicationFormTemplatePayloadSchema,
  EVENT_CONFIGURATION_MODULE_KEY,
  EVENT_CONFIGURATION_SCHEMA_VERSION,
  requirePermission,
  validateContactFields,
  validateFormFieldRequirement,
} from "@shime/core";
import {
  auditLogs,
  eventFormFields,
  events,
  getDatabase,
  resourceTemplateApplications,
  resourceTemplates,
} from "@shime/db";
import { requireStaffSession } from "../../../../../../server/auth";

const fieldsInput = z
  .array(
    z.object({
      fieldKey: z.string().regex(/^[a-z0-9_]{2,80}$/),
      label: z.string().trim().min(1).max(160),
      type: z.enum(["text", "email", "tel", "date", "select", "checkbox"]),
      requirement: z.enum(["required", "optional", "hidden"]),
      displayOrder: z.number().int().min(1),
      validation: z.record(z.string(), z.unknown()).default({}),
    }),
  )
  .min(1);
const updateInput = z.union([
  fieldsInput.transform((fields) => ({ fields, sourceTemplateId: undefined as string | undefined })),
  z.object({ fields: fieldsInput, sourceTemplateId: z.string().uuid().optional() }),
]);
type Context = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const { eventId } = await context.params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const data = await getDatabase()
    .select()
    .from(eventFormFields)
    .where(and(eq(eventFormFields.tenantId, session.tenantId), eq(eventFormFields.eventId, eventId)));
  return NextResponse.json({ data });
}

export async function PUT(request: Request, context: Context) {
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
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  try {
    parsed.data.fields.forEach((field) => validateFormFieldRequirement(field.fieldKey, field.requirement));
    validateContactFields(parsed.data.fields);
  } catch (error) {
    return NextResponse.json(
      {
        code: "INVALID_FIELD_CONFIGURATION",
        message: error instanceof Error ? error.message : "Invalid configuration",
        request_id: requestId,
      },
      { status: 400 },
    );
  }
  const db = getDatabase();
  const event = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  if (!event[0]) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  const sourceTemplate = parsed.data.sourceTemplateId
    ? (
        await db
          .select()
          .from(resourceTemplates)
          .where(
            and(
              eq(resourceTemplates.id, parsed.data.sourceTemplateId),
              eq(resourceTemplates.tenantId, session.tenantId),
              eq(resourceTemplates.moduleKey, EVENT_CONFIGURATION_MODULE_KEY),
              eq(resourceTemplates.templateType, APPLICATION_FORM_TEMPLATE_TYPE),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (parsed.data.sourceTemplateId && !sourceTemplate)
    return NextResponse.json({ code: "SOURCE_TEMPLATE_NOT_FOUND", request_id: requestId }, { status: 404 });
  const snapshot = applicationFormTemplatePayloadSchema.parse({
    schemaVersion: EVENT_CONFIGURATION_SCHEMA_VERSION,
    fields: parsed.data.fields,
  });
  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  await db.transaction(async (tx) => {
    await tx
      .delete(eventFormFields)
      .where(and(eq(eventFormFields.tenantId, session.tenantId), eq(eventFormFields.eventId, eventId)));
    await tx
      .insert(eventFormFields)
      .values(parsed.data.fields.map((field) => ({ ...field, tenantId: session.tenantId, eventId })));
    if (sourceTemplate)
      await tx.insert(resourceTemplateApplications).values({
        tenantId: session.tenantId,
        moduleKey: EVENT_CONFIGURATION_MODULE_KEY,
        templateType: APPLICATION_FORM_TEMPLATE_TYPE,
        templateId: sourceTemplate.id,
        templateVersion: sourceTemplate.version,
        targetType: "event",
        targetId: eventId,
        appliedSnapshot: snapshot,
        snapshotHash,
        appliedBy: session.userId,
      });
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "event.form_fields.replace",
      targetType: "event",
      targetId: eventId,
      after: {
        fieldCount: parsed.data.fields.length,
        sourceTemplateId: sourceTemplate?.id,
        sourceTemplateVersion: sourceTemplate?.version,
        snapshotHash,
      },
      requestId,
    });
  });
  return NextResponse.json({ ok: true, request_id: requestId });
}
