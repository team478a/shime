import { and, asc, eq, inArray } from "drizzle-orm";
import {
  eventQuestionnaires,
  getDatabase,
  lovePassports,
  questionnaireAnswers,
  questionnaireOptions,
  questionnaireQuestions,
  questionnaireResponses,
} from "@shime/db";
import type { QuestionnaireRepository } from "./repository";
import type { QuestionnaireAnswerInput, QuestionnaireResponse, QuestionnaireScope } from "./types";

export function createDrizzleQuestionnaireRepository(): QuestionnaireRepository {
  return {
    async findConfiguredVersion(scope) {
      const row = (
        await getDatabase()
          .select({ versionId: eventQuestionnaires.versionId })
          .from(eventQuestionnaires)
          .where(and(eq(eventQuestionnaires.tenantId, scope.tenantId), eq(eventQuestionnaires.eventId, scope.eventId)))
          .limit(1)
      )[0];
      return row?.versionId ?? null;
    },

    async listQuestions(scope, versionId) {
      return getDatabase()
        .select()
        .from(questionnaireQuestions)
        .where(
          and(eq(questionnaireQuestions.tenantId, scope.tenantId), eq(questionnaireQuestions.versionId, versionId)),
        )
        .orderBy(asc(questionnaireQuestions.displayOrder));
    },

    async listOptions(scope, questionIds) {
      if (questionIds.length === 0) return [];
      return getDatabase()
        .select()
        .from(questionnaireOptions)
        .where(
          and(eq(questionnaireOptions.tenantId, scope.tenantId), inArray(questionnaireOptions.questionId, questionIds)),
        )
        .orderBy(asc(questionnaireOptions.displayOrder));
    },

    async findResponse(scope, versionId) {
      const conditions = [
        eq(questionnaireResponses.tenantId, scope.tenantId),
        eq(questionnaireResponses.eventId, scope.eventId),
        eq(questionnaireResponses.participantId, scope.participantId),
      ];
      if (versionId) conditions.push(eq(questionnaireResponses.versionId, versionId));
      return (
        (
          await getDatabase()
            .select()
            .from(questionnaireResponses)
            .where(and(...conditions))
            .limit(1)
        )[0] ?? null
      );
    },

    async listAnswers(scope, responseId) {
      return getDatabase()
        .select()
        .from(questionnaireAnswers)
        .where(
          and(
            eq(questionnaireAnswers.tenantId, scope.tenantId),
            eq(questionnaireAnswers.eventId, scope.eventId),
            eq(questionnaireAnswers.responseId, responseId),
          ),
        );
    },

    async saveDraft(scope, versionId, answers, existingResponse) {
      return getDatabase().transaction(async (transaction) => {
        const response = existingResponse ?? (await createResponse(transaction, scope, versionId));
        for (const answer of answers) await saveAnswer(transaction, scope, response.id, answer);
        return response;
      });
    },

    async submit(scope, responseId, markPassportReady, submittedAt) {
      await getDatabase().transaction(async (transaction) => {
        await transaction
          .update(questionnaireResponses)
          .set({ status: "submitted", submittedAt, updatedAt: submittedAt })
          .where(
            and(
              eq(questionnaireResponses.id, responseId),
              eq(questionnaireResponses.tenantId, scope.tenantId),
              eq(questionnaireResponses.eventId, scope.eventId),
              eq(questionnaireResponses.participantId, scope.participantId),
            ),
          );
        if (markPassportReady)
          await transaction
            .update(lovePassports)
            .set({ status: "ready", readyAt: submittedAt, updatedAt: submittedAt })
            .where(
              and(
                eq(lovePassports.tenantId, scope.tenantId),
                eq(lovePassports.eventId, scope.eventId),
                eq(lovePassports.participantId, scope.participantId),
                eq(lovePassports.status, "issued"),
              ),
            );
      });
    },
  };
}

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

async function createResponse(
  transaction: Transaction,
  scope: QuestionnaireScope,
  versionId: string,
): Promise<QuestionnaireResponse> {
  return (
    await transaction
      .insert(questionnaireResponses)
      .values({
        tenantId: scope.tenantId,
        eventId: scope.eventId,
        participantId: scope.participantId,
        versionId,
        status: "draft",
      })
      .returning()
  )[0]!;
}

async function saveAnswer(
  transaction: Transaction,
  scope: QuestionnaireScope,
  responseId: string,
  answer: QuestionnaireAnswerInput,
) {
  await transaction
    .insert(questionnaireAnswers)
    .values({
      tenantId: scope.tenantId,
      eventId: scope.eventId,
      responseId,
      ...answer,
      optionCodes: answer.declined ? [] : answer.optionCodes,
    })
    .onConflictDoUpdate({
      target: [questionnaireAnswers.tenantId, questionnaireAnswers.responseId, questionnaireAnswers.questionId],
      set: {
        optionCodes: answer.declined ? [] : answer.optionCodes,
        declined: answer.declined,
        updatedAt: new Date(),
      },
    });
}
