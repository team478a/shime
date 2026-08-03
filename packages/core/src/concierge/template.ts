import { z } from "zod";

export const CONCIERGE_MODULE_KEY = "concierge";
export const CONCIERGE_TEMPLATE_SCHEMA_VERSION = 1;
export const CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION = 2;
export type ConciergeTemplateSchemaVersion =
  typeof CONCIERGE_TEMPLATE_SCHEMA_VERSION | typeof CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION;

export const conciergeProtectedMessageKeySchema = z.enum([
  "auth_required",
  "permission_denied",
  "identity_verification_required",
  "personal_data_notice",
  "ai_consent_required",
  "system_error",
]);

const editableCopySchema = z.object({
  pageTitle: z.string().trim().max(160).default(""),
  intro: z.string().trim().max(2_000).default(""),
  instructions: z.string().trim().max(4_000).default(""),
  completionTitle: z.string().trim().max(160).default(""),
  completionBody: z.string().trim().max(4_000).default(""),
  startButton: z.string().trim().max(80).default(""),
  nextButton: z.string().trim().max(80).default(""),
  backButton: z.string().trim().max(80).default(""),
  completeButton: z.string().trim().max(80).default(""),
});

const reportCopySchema = z.object({
  title: z.string().trim().max(160).default(""),
  heading: z.string().trim().max(240).default(""),
  fixedText: z.string().trim().max(8_000).default(""),
  disclaimer: z.string().trim().max(4_000).default(""),
  guidance: z.string().trim().max(4_000).default(""),
});

export const conciergeQuestionSchema = z.object({
  axisCode: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/),
  prompt: z.string().trim().max(500),
  supplementalText: z.string().trim().max(2_000).default(""),
  required: z.boolean().default(true),
  displayOrder: z.number().int().min(1).max(4),
  options: z
    .array(
      z.object({
        code: z
          .string()
          .trim()
          .regex(/^[a-z0-9_]{1,80}$/),
        label: z.string().trim().max(200),
        displayOrder: z.number().int().min(1).max(100),
      }),
    )
    .max(40)
    .default([]),
});

export const conciergeEmotionSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/),
  label: z.string().trim().max(120),
  description: z.string().trim().max(1_000).default(""),
  displayOrder: z.number().int().min(1).max(8),
  active: z.boolean().default(true),
});

export const conciergeCardMappingSchema = z.object({
  cardAssetVersionId: z.string().uuid(),
  emotionCode: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/),
  displayOrder: z.number().int().min(1).max(1_000),
  active: z.boolean().default(true),
});

const conciergeTemplatePayloadBase = {
  copy: editableCopySchema.default({
    pageTitle: "",
    intro: "",
    instructions: "",
    completionTitle: "",
    completionBody: "",
    startButton: "",
    nextButton: "",
    backButton: "",
    completeButton: "",
  }),
  reportCopy: reportCopySchema.default({
    title: "",
    heading: "",
    fixedText: "",
    disclaimer: "",
    guidance: "",
  }),
  protectedMessageKeys: z.array(conciergeProtectedMessageKeySchema).default([]),
  emotions: z.array(conciergeEmotionSchema).max(8).default([]),
  cardMappings: z.array(conciergeCardMappingSchema).max(1_000).default([]),
} as const;

export const conciergeTemplateV1PayloadSchema = z.object({
  ...conciergeTemplatePayloadBase,
  schemaVersion: z.literal(CONCIERGE_TEMPLATE_SCHEMA_VERSION),
  questions: z.array(conciergeQuestionSchema).max(4).default([]),
});

export const conciergeMarriageV2TemplatePayloadSchema = z.object({
  ...conciergeTemplatePayloadBase,
  schemaVersion: z.literal(CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION),
  questions: z.array(conciergeQuestionSchema).max(3).default([]),
});

export const conciergeTemplatePayloadSchema = z.discriminatedUnion("schemaVersion", [
  conciergeTemplateV1PayloadSchema,
  conciergeMarriageV2TemplatePayloadSchema,
]);

export type ConciergeTemplatePayload = z.infer<typeof conciergeTemplatePayloadSchema>;

export type ConciergePublishIssue = Readonly<{
  code:
    | "FOUR_AXES_REQUIRED"
    | "THREE_QUESTIONS_REQUIRED"
    | "QUESTION_INCOMPLETE"
    | "EIGHT_EMOTIONS_REQUIRED"
    | "DUPLICATE_CODE"
    | "CARD_MAPPING_INVALID";
  message: string;
}>;

export function validateConciergeTemplateForPublish(payload: ConciergeTemplatePayload): ConciergePublishIssue[] {
  const issues: ConciergePublishIssue[] = [];
  const activeEmotions = payload.emotions.filter((emotion) => emotion.active);
  const axisCodes = new Set(payload.questions.map((question) => question.axisCode));
  const emotionCodes = new Set(activeEmotions.map((emotion) => emotion.code));

  const expectedQuestionCount = payload.schemaVersion === CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION ? 3 : 4;
  if (payload.questions.length !== expectedQuestionCount || axisCodes.size !== expectedQuestionCount) {
    issues.push(
      payload.schemaVersion === CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION
        ? { code: "THREE_QUESTIONS_REQUIRED", message: "婚活版v2には3つの異なる設問が必要です。" }
        : { code: "FOUR_AXES_REQUIRED", message: "4つの異なる分析軸に対応する設問が必要です。" },
    );
  }
  if (payload.questions.some((question) => !question.prompt || question.options.length === 0)) {
    issues.push({ code: "QUESTION_INCOMPLETE", message: "各設問に本文と1件以上の選択肢が必要です。" });
  }
  if (activeEmotions.length !== 8 || emotionCodes.size !== 8) {
    issues.push({ code: "EIGHT_EMOTIONS_REQUIRED", message: "8つの異なる感情コードをすべて有効にしてください。" });
  }
  if (
    new Set(
      payload.questions.flatMap((question) => question.options.map((option) => `${question.axisCode}:${option.code}`)),
    ).size !== payload.questions.reduce((count, question) => count + question.options.length, 0)
  ) {
    issues.push({ code: "DUPLICATE_CODE", message: "同じ設問内で選択肢コードを重複できません。" });
  }
  if (payload.cardMappings.some((mapping) => !emotionCodes.has(mapping.emotionCode))) {
    issues.push({ code: "CARD_MAPPING_INVALID", message: "無効または未登録の感情コードを参照するカードがあります。" });
  }
  return issues;
}

export function createEmptyConciergeTemplate(
  schemaVersion: ConciergeTemplateSchemaVersion = CONCIERGE_TEMPLATE_SCHEMA_VERSION,
): ConciergeTemplatePayload {
  return conciergeTemplatePayloadSchema.parse({ schemaVersion });
}
