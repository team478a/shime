import { describe, expect, it, vi } from "vitest";
import {
  GetQuestionnaire,
  type QuestionnaireAnswer,
  type QuestionnaireOption,
  type QuestionnaireQuestion,
  type QuestionnaireRepository,
  type QuestionnaireResponse,
  SaveQuestionnaireDraft,
  SubmitQuestionnaire,
} from "@shime/questionnaire";

const now = new Date("2026-07-24T00:00:00.000Z");
const scope = { tenantId: "tenant-1", eventId: "event-1", participantId: "participant-1" };
const response: QuestionnaireResponse = {
  id: "response-1",
  ...scope,
  versionId: "version-1",
  status: "draft",
  submittedAt: null,
  createdAt: now,
  updatedAt: now,
};

function question(id: string, displayOrder = 1): QuestionnaireQuestion {
  return {
    id,
    tenantId: scope.tenantId,
    versionId: "version-1",
    axis: `axis-${displayOrder}`,
    prompt: `Question ${displayOrder}`,
    kind: "single",
    maxSelections: 1,
    displayOrder,
    weight: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function option(questionId: string): QuestionnaireOption {
  return {
    id: `option-${questionId}`,
    tenantId: scope.tenantId,
    questionId,
    code: "yes",
    label: "Yes",
    scoreValue: 1,
    displayOrder: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function answer(questionId: string): QuestionnaireAnswer {
  return {
    id: `answer-${questionId}`,
    tenantId: scope.tenantId,
    eventId: scope.eventId,
    responseId: response.id,
    questionId,
    optionCodes: ["yes"],
    declined: false,
    createdAt: now,
    updatedAt: now,
  };
}

function repository(overrides: Partial<QuestionnaireRepository> = {}): QuestionnaireRepository {
  return {
    findConfiguredVersion: async () => "version-1",
    listQuestions: async () => [],
    listOptions: async () => [],
    findResponse: async () => null,
    listAnswers: async () => [],
    saveDraft: async () => response,
    submit: async () => undefined,
    ...overrides,
  };
}

describe("Questionnaire use cases", () => {
  it("preserves the not-configured contract", async () => {
    const useCase = new GetQuestionnaire(repository({ findConfiguredVersion: async () => null }));

    await expect(useCase.execute(scope)).resolves.toEqual({
      ok: false,
      code: "QUESTIONNAIRE_NOT_CONFIGURED",
      status: 409,
    });
  });

  it("builds the participant view without exposing answers from another response", async () => {
    const firstQuestion = question("question-1");
    const firstOption = option(firstQuestion.id);
    const firstAnswer = answer(firstQuestion.id);
    const useCase = new GetQuestionnaire(
      repository({
        listQuestions: async () => [firstQuestion],
        listOptions: async () => [firstOption],
        findResponse: async () => response,
        listAnswers: async (_scope, responseId) => (responseId === response.id ? [firstAnswer] : []),
      }),
    );

    const result = await useCase.execute(scope);

    expect(result).toEqual({
      ok: true,
      data: {
        versionId: "version-1",
        status: "draft",
        questions: [{ ...firstQuestion, options: [firstOption] }],
        answers: [firstAnswer],
      },
    });
  });

  it("rejects an option that is not defined for the submitted question", async () => {
    const saveDraft = vi.fn(async () => response);
    const firstQuestion = question("question-1");
    const useCase = new SaveQuestionnaireDraft(
      repository({
        listQuestions: async () => [firstQuestion],
        listOptions: async () => [option(firstQuestion.id)],
        saveDraft,
      }),
    );

    await expect(
      useCase.execute(scope, [{ questionId: firstQuestion.id, optionCodes: ["invalid"], declined: false }]),
    ).resolves.toEqual({ ok: false, code: "INVALID_ANSWER", status: 400 });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("submits five complete answers and readies an eligible passport", async () => {
    const questions = Array.from({ length: 5 }, (_, index) => question(`question-${index + 1}`, index + 1));
    const submit = vi.fn(async () => undefined);
    const useCase = new SubmitQuestionnaire(
      repository({
        findResponse: async () => response,
        listQuestions: async () => questions,
        listAnswers: async () => questions.map((item) => answer(item.id)),
        submit,
      }),
    );

    await expect(useCase.execute(scope, "confirmed")).resolves.toEqual({
      ok: true,
      data: { status: "submitted" },
    });
    expect(submit).toHaveBeenCalledWith(scope, response.id, true, expect.any(Date));
  });
});
