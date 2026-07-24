export type QuestionnaireScope = {
  tenantId: string;
  eventId: string;
  participantId: string;
};

export type QuestionnaireAnswerInput = {
  questionId: string;
  optionCodes: string[];
  declined: boolean;
};

export type QuestionnaireQuestion = {
  id: string;
  tenantId: string;
  versionId: string;
  axis: string;
  prompt: string;
  kind: string;
  maxSelections: number;
  displayOrder: number;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionnaireOption = {
  id: string;
  tenantId: string;
  questionId: string;
  code: string;
  label: string;
  scoreValue: number | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionnaireResponse = {
  id: string;
  tenantId: string;
  eventId: string;
  participantId: string;
  versionId: string;
  status: "draft" | "submitted";
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionnaireAnswer = {
  id: string;
  tenantId: string;
  eventId: string;
  responseId: string;
  questionId: string;
  optionCodes: string[];
  declined: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionnaireView = {
  versionId: string;
  status: "draft" | "submitted";
  questions: Array<QuestionnaireQuestion & { options: QuestionnaireOption[] }>;
  answers: QuestionnaireAnswer[];
};

export type QuestionnaireResult<T> = { ok: true; data: T } | { ok: false; code: string; status: 400 | 409 };
