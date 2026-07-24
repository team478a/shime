import type {
  QuestionnaireAnswer,
  QuestionnaireAnswerInput,
  QuestionnaireOption,
  QuestionnaireQuestion,
  QuestionnaireResponse,
  QuestionnaireScope,
} from "./types";

export interface QuestionnaireRepository {
  findConfiguredVersion(scope: QuestionnaireScope): Promise<string | null>;
  listQuestions(scope: QuestionnaireScope, versionId: string): Promise<QuestionnaireQuestion[]>;
  listOptions(scope: QuestionnaireScope, questionIds: string[]): Promise<QuestionnaireOption[]>;
  findResponse(scope: QuestionnaireScope, versionId?: string): Promise<QuestionnaireResponse | null>;
  listAnswers(scope: QuestionnaireScope, responseId: string): Promise<QuestionnaireAnswer[]>;
  saveDraft(
    scope: QuestionnaireScope,
    versionId: string,
    answers: QuestionnaireAnswerInput[],
    existingResponse: QuestionnaireResponse | null,
  ): Promise<QuestionnaireResponse>;
  submit(scope: QuestionnaireScope, responseId: string, markPassportReady: boolean, submittedAt: Date): Promise<void>;
}
