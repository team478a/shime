import { describe, expect, it } from "vitest";
import {
  CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION,
  CONCIERGE_TEMPLATE_SCHEMA_VERSION,
  conciergeTemplatePayloadSchema,
  createEmptyConciergeTemplate,
  validateConciergeTemplateForPublish,
} from "@shime/core";

function completePayload(
  schemaVersion:
    | typeof CONCIERGE_TEMPLATE_SCHEMA_VERSION
    | typeof CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION = CONCIERGE_TEMPLATE_SCHEMA_VERSION,
) {
  const questionCount = schemaVersion === CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION ? 3 : 4;
  return conciergeTemplatePayloadSchema.parse({
    ...createEmptyConciergeTemplate(schemaVersion),
    schemaVersion,
    questions: Array.from({ length: questionCount }, (_, index) => ({
      axisCode: `axis_${index + 1}`,
      prompt: `設問${index + 1}`,
      displayOrder: index + 1,
      options: [{ code: "yes", label: "はい", displayOrder: 1 }],
    })),
    emotions: Array.from({ length: 8 }, (_, index) => ({
      code: `emotion_${index + 1}`,
      label: `感情${index + 1}`,
      displayOrder: index + 1,
      active: true,
    })),
  });
}

describe("concierge template publication", () => {
  it("allows incomplete drafts but blocks them from publication", () => {
    const draft = createEmptyConciergeTemplate();
    expect(conciergeTemplatePayloadSchema.safeParse(draft).success).toBe(true);
    expect(validateConciergeTemplateForPublish(draft).map((issue) => issue.code)).toEqual([
      "FOUR_AXES_REQUIRED",
      "EIGHT_EMOTIONS_REQUIRED",
    ]);
  });

  it("accepts four distinct axes and eight active emotion codes", () => {
    expect(validateConciergeTemplateForPublish(completePayload())).toEqual([]);
  });

  it("accepts exactly three questions for a marriage v2 template", () => {
    expect(validateConciergeTemplateForPublish(completePayload(CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION))).toEqual(
      [],
    );
  });

  it("keeps the question-count rules isolated by schema version", () => {
    const v1WithThreeQuestions = { ...completePayload(), questions: completePayload().questions.slice(0, 3) };
    const v2 = completePayload(CONCIERGE_MARRIAGE_V2_TEMPLATE_SCHEMA_VERSION);
    const v2WithTwoQuestions = { ...v2, questions: v2.questions.slice(0, 2) };

    expect(validateConciergeTemplateForPublish(v1WithThreeQuestions).map((issue) => issue.code)).toContain(
      "FOUR_AXES_REQUIRED",
    );
    expect(validateConciergeTemplateForPublish(v2WithTwoQuestions).map((issue) => issue.code)).toContain(
      "THREE_QUESTIONS_REQUIRED",
    );
  });

  it("rejects a card mapping to an inactive or unknown emotion", () => {
    const payload = completePayload();
    payload.cardMappings.push({
      cardAssetVersionId: "00000000-0000-4000-8000-000000000001",
      emotionCode: "unknown_emotion",
      displayOrder: 1,
      active: true,
    });
    expect(validateConciergeTemplateForPublish(payload)).toContainEqual(
      expect.objectContaining({ code: "CARD_MAPPING_INVALID" }),
    );
  });
});
