import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EVENT_CONFIGURATION_MODULE_KEY,
  EVENT_CONFIGURATION_SCHEMA_VERSION,
  QUESTIONNAIRE_TEMPLATE_TYPE,
  questionnaireTemplatePayloadSchema,
  requirePermission,
  SEATING_AXES,
} from "@shime/core";
import {
  auditLogs,
  eventQuestionnaires,
  events,
  getDatabase,
  questionnaireOptions,
  questionnaireQuestions,
  questionnaires,
  questionnaireVersions,
  resourceTemplateApplications,
  resourceTemplates,
} from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
const option = z.object({
  code: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  scoreValue: z.number().int().nullable(),
});
const question = z.object({
  axis: z.enum(SEATING_AXES),
  prompt: z.string().min(1).max(300),
  kind: z.enum(["multi_select", "ordinal", "complement"]),
  maxSelections: z.number().int().min(1).max(10),
  weight: z.number().int().min(1).max(100),
  options: z.array(option).min(2).max(30),
});
const input = z
  .object({
    code: z.string().regex(/^[a-z0-9_-]{2,80}$/),
    name: z.string().min(1).max(160),
    version: z.number().int().positive(),
    questions: z.array(question).length(5),
    sourceTemplateId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.questions.map((q) => q.axis)).size !== 5)
      ctx.addIssue({ code: "custom", message: "Five unique axes are required" });
    if (value.questions.reduce((sum, q) => sum + q.weight, 0) !== 100)
      ctx.addIssue({ code: "custom", message: "Weights must total 100" });
  });
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "event:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { code: "INVALID_INPUT", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  const db = getDatabase();
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  if (!event[0]) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  if (event[0].startsAt <= new Date()) return NextResponse.json({ code: "EVENT_ALREADY_STARTED" }, { status: 409 });
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
              eq(resourceTemplates.templateType, QUESTIONNAIRE_TEMPLATE_TYPE),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (parsed.data.sourceTemplateId && !sourceTemplate)
    return NextResponse.json({ code: "SOURCE_TEMPLATE_NOT_FOUND" }, { status: 404 });
  const existingQuestionnaire = await db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.tenantId, session.tenantId), eq(questionnaires.code, parsed.data.code)))
    .limit(1);
  const duplicateVersion = existingQuestionnaire[0]
    ? await db
        .select()
        .from(questionnaireVersions)
        .where(
          and(
            eq(questionnaireVersions.tenantId, session.tenantId),
            eq(questionnaireVersions.questionnaireId, existingQuestionnaire[0].id),
            eq(questionnaireVersions.version, parsed.data.version),
          ),
        )
        .limit(1)
    : [];
  if (duplicateVersion[0]) return NextResponse.json({ code: "VERSION_ALREADY_EXISTS" }, { status: 409 });
  const snapshot = questionnaireTemplatePayloadSchema.parse({
    schemaVersion: EVENT_CONFIGURATION_SCHEMA_VERSION,
    code: parsed.data.code,
    name: parsed.data.name,
    questions: parsed.data.questions,
  });
  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  await db.transaction(async (tx) => {
    const [template] = existingQuestionnaire[0]
      ? await tx
          .update(questionnaires)
          .set({ name: parsed.data.name, updatedAt: new Date() })
          .where(eq(questionnaires.id, existingQuestionnaire[0].id))
          .returning()
      : await tx
          .insert(questionnaires)
          .values({ tenantId: session.tenantId, code: parsed.data.code, name: parsed.data.name })
          .returning();
    if (!template) throw new Error("QUESTIONNAIRE_CREATE_FAILED");
    await tx
      .update(questionnaireVersions)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(questionnaireVersions.tenantId, session.tenantId),
          eq(questionnaireVersions.questionnaireId, template.id),
        ),
      );
    const [version] = await tx
      .insert(questionnaireVersions)
      .values({ tenantId: session.tenantId, questionnaireId: template.id, version: parsed.data.version, active: true })
      .returning();
    if (!version) throw new Error("VERSION_CREATE_FAILED");
    for (const [index, item] of parsed.data.questions.entries()) {
      const [savedQuestion] = await tx
        .insert(questionnaireQuestions)
        .values({
          tenantId: session.tenantId,
          versionId: version.id,
          axis: item.axis,
          prompt: item.prompt,
          kind: item.kind,
          maxSelections: item.maxSelections,
          displayOrder: index + 1,
          weight: item.weight,
        })
        .returning();
      if (!savedQuestion) throw new Error("QUESTION_CREATE_FAILED");
      await tx.insert(questionnaireOptions).values(
        item.options.map((entry, optionIndex) => ({
          tenantId: session.tenantId,
          questionId: savedQuestion.id,
          code: entry.code,
          label: entry.label,
          scoreValue: entry.scoreValue,
          displayOrder: optionIndex + 1,
        })),
      );
    }
    await tx
      .insert(eventQuestionnaires)
      .values({ tenantId: session.tenantId, eventId, versionId: version.id })
      .onConflictDoUpdate({
        target: eventQuestionnaires.eventId,
        set: { versionId: version.id, updatedAt: new Date() },
      });
    if (sourceTemplate)
      await tx.insert(resourceTemplateApplications).values({
        tenantId: session.tenantId,
        moduleKey: EVENT_CONFIGURATION_MODULE_KEY,
        templateType: QUESTIONNAIRE_TEMPLATE_TYPE,
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
      action: "questionnaire.settings.update",
      targetType: "questionnaire_version",
      targetId: version.id,
      after: {
        code: parsed.data.code,
        version: parsed.data.version,
        sourceTemplateId: sourceTemplate?.id,
        sourceTemplateVersion: sourceTemplate?.version,
        snapshotHash,
      },
      requestId,
    });
  });
  return NextResponse.json({ ok: true });
}
