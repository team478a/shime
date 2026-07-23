import { asc, and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  eventQuestionnaires,
  getDatabase,
  questionnaireOptions,
  questionnaireQuestions,
  questionnaireVersions,
  questionnaires,
  resourceTemplates,
} from "@shime/db";
import {
  EVENT_CONFIGURATION_MODULE_KEY,
  QUESTIONNAIRE_TEMPLATE_TYPE,
  questionnaireTemplatePayloadSchema,
} from "@shime/core";
import { requireStaffSession } from "@shime/web/server/auth";
import type { QuestionnaireAxis, QuestionnaireKind } from "../../../../../lib/questionnaire-editor";
import { QuestionnaireSettingsForm } from "./questionnaire-settings-form";

export default async function QuestionnairePage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) redirect("/admin/login");
  const { eventId } = await params;
  const db = getDatabase();
  const current = await db
    .select({
      code: questionnaires.code,
      name: questionnaires.name,
      version: questionnaireVersions.version,
      versionId: questionnaireVersions.id,
    })
    .from(eventQuestionnaires)
    .innerJoin(
      questionnaireVersions,
      and(
        eq(questionnaireVersions.id, eventQuestionnaires.versionId),
        eq(questionnaireVersions.tenantId, eventQuestionnaires.tenantId),
      ),
    )
    .innerJoin(
      questionnaires,
      and(
        eq(questionnaires.id, questionnaireVersions.questionnaireId),
        eq(questionnaires.tenantId, eventQuestionnaires.tenantId),
      ),
    )
    .where(and(eq(eventQuestionnaires.tenantId, session.tenantId), eq(eventQuestionnaires.eventId, eventId)))
    .limit(1);
  const questions = current[0]
    ? await db
        .select()
        .from(questionnaireQuestions)
        .where(
          and(
            eq(questionnaireQuestions.tenantId, session.tenantId),
            eq(questionnaireQuestions.versionId, current[0].versionId),
          ),
        )
        .orderBy(asc(questionnaireQuestions.displayOrder))
    : [];
  const options = questions.length
    ? await db
        .select()
        .from(questionnaireOptions)
        .where(
          and(
            eq(questionnaireOptions.tenantId, session.tenantId),
            inArray(
              questionnaireOptions.questionId,
              questions.map((question) => question.id),
            ),
          ),
        )
        .orderBy(asc(questionnaireOptions.displayOrder))
    : [];
  const optionsByQuestion = options.reduce((map, option) => {
    const currentOptions = map.get(option.questionId) ?? [];
    currentOptions.push(option);
    map.set(option.questionId, currentOptions);
    return map;
  }, new Map<string, typeof options>());
  const initial = current[0]
    ? {
        code: current[0].code,
        name: current[0].name,
        version: current[0].version,
        questions: questions.map((question) => ({
          axis: question.axis as QuestionnaireAxis,
          prompt: question.prompt,
          kind: question.kind as QuestionnaireKind,
          maxSelections: question.maxSelections,
          weight: question.weight,
          options: (optionsByQuestion.get(question.id) ?? []).map((option) => ({
            code: option.code,
            label: option.label,
            scoreValue: option.scoreValue,
          })),
        })),
      }
    : null;
  const templateRows = await db
    .select()
    .from(resourceTemplates)
    .where(
      and(
        eq(resourceTemplates.tenantId, session.tenantId),
        eq(resourceTemplates.moduleKey, EVENT_CONFIGURATION_MODULE_KEY),
        eq(resourceTemplates.templateType, QUESTIONNAIRE_TEMPLATE_TYPE),
        eq(resourceTemplates.active, true),
      ),
    )
    .orderBy(desc(resourceTemplates.updatedAt));
  const templates = templateRows.flatMap((template) => {
    const payload = questionnaireTemplatePayloadSchema.safeParse(template.payload);
    return payload.success
      ? [
          {
            id: template.id,
            templateName: template.name,
            version: template.version,
            code: payload.data.code,
            name: payload.data.name,
            questions: payload.data.questions,
          },
        ]
      : [];
  });
  return (
    <main>
      <QuestionnaireSettingsForm
        eventId={eventId}
        current={initial}
        templates={templates}
        canManageTemplates={!session.eventId}
      />
    </main>
  );
}
