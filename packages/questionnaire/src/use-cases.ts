import type { QuestionnaireRepository } from "./repository";
import type { QuestionnaireAnswerInput, QuestionnaireResult, QuestionnaireScope, QuestionnaireView } from "./types";

const notConfigured = (): QuestionnaireResult<never> => ({
  ok: false,
  code: "QUESTIONNAIRE_NOT_CONFIGURED",
  status: 409,
});

export class GetQuestionnaire {
  constructor(private readonly repository: QuestionnaireRepository) {}

  async execute(scope: QuestionnaireScope): Promise<QuestionnaireResult<QuestionnaireView>> {
    const versionId = await this.repository.findConfiguredVersion(scope);
    if (!versionId) return notConfigured();

    const questions = await this.repository.listQuestions(scope, versionId);
    const options = await this.repository.listOptions(
      scope,
      questions.map((question) => question.id),
    );
    const response = await this.repository.findResponse(scope);
    const answers = response ? await this.repository.listAnswers(scope, response.id) : [];

    return {
      ok: true,
      data: {
        versionId,
        status: response?.status ?? "draft",
        questions: questions.map((question) => ({
          ...question,
          options: options.filter((option) => option.questionId === question.id),
        })),
        answers,
      },
    };
  }
}

export class SaveQuestionnaireDraft {
  constructor(private readonly repository: QuestionnaireRepository) {}

  async execute(
    scope: QuestionnaireScope,
    answers: QuestionnaireAnswerInput[],
  ): Promise<QuestionnaireResult<Awaited<ReturnType<QuestionnaireRepository["saveDraft"]>>>> {
    const versionId = await this.repository.findConfiguredVersion(scope);
    if (!versionId) return notConfigured();

    const questions = await this.repository.listQuestions(scope, versionId);
    const options = await this.repository.listOptions(
      scope,
      questions.map((question) => question.id),
    );
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const optionSet = new Set(options.map((option) => `${option.questionId}:${option.code}`));
    const invalid = answers.some((answer) => {
      const question = questionById.get(answer.questionId);
      return (
        !question ||
        (!answer.declined &&
          (answer.optionCodes.length < 1 ||
            answer.optionCodes.length > question.maxSelections ||
            new Set(answer.optionCodes).size !== answer.optionCodes.length ||
            answer.optionCodes.some((code) => !optionSet.has(`${answer.questionId}:${code}`))))
      );
    });
    if (invalid) return { ok: false, code: "INVALID_ANSWER", status: 400 };

    const existing = await this.repository.findResponse(scope);
    if (existing?.status === "submitted") return { ok: false, code: "ALREADY_SUBMITTED", status: 409 };

    return {
      ok: true,
      data: await this.repository.saveDraft(scope, versionId, answers, existing),
    };
  }
}

export class SubmitQuestionnaire {
  constructor(private readonly repository: QuestionnaireRepository) {}

  async execute(scope: QuestionnaireScope, dreamState: string): Promise<QuestionnaireResult<{ status: "submitted" }>> {
    const versionId = await this.repository.findConfiguredVersion(scope);
    if (!versionId) return notConfigured();

    const response = await this.repository.findResponse(scope, versionId);
    if (!response) return { ok: false, code: "INCOMPLETE", status: 409 };

    const questions = await this.repository.listQuestions(scope, versionId);
    const answers = await this.repository.listAnswers(scope, response.id);
    if (
      questions.length !== 5 ||
      answers.length !== questions.length ||
      answers.some((answer) => !answer.declined && answer.optionCodes.length === 0)
    )
      return { ok: false, code: "INCOMPLETE", status: 409 };

    await this.repository.submit(
      scope,
      response.id,
      dreamState === "confirmed" || dreamState === "skipped",
      new Date(),
    );
    return { ok: true, data: { status: "submitted" } };
  }
}
