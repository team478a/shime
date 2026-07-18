import { describe, expect, it } from "vitest";

import {
  applicationFormTemplatePayloadSchema,
  nextEventConfigurationTemplateVersion,
  questionnaireTemplatePayloadSchema,
} from "@shime/core";

describe("event configuration templates", () => {
  it("validates an application form snapshot", () => {
    expect(applicationFormTemplatePayloadSchema.safeParse({ schemaVersion: 1, fields: [
      { fieldKey: "phone", label: "電話番号", type: "tel", requirement: "required", displayOrder: 1, validation: {} },
    ] }).success).toBe(true);
  });

  it("requires five questionnaire axes and total weight 100", () => {
    const question = (axis: "values" | "marriage_intent" | "relationship_pace" | "conversation_style" | "topic_overlap", weight: number) => ({ axis, prompt: "質問", kind: "multi_select" as const, maxSelections: 1, weight, options: [{ code: "a", label: "A", scoreValue: null }, { code: "b", label: "B", scoreValue: null }] });
    const result = questionnaireTemplatePayloadSchema.safeParse({ schemaVersion: 1, code: "standard", name: "標準", questions: [question("values", 20), question("marriage_intent", 20), question("relationship_pace", 20), question("conversation_style", 20), question("topic_overlap", 20)] });
    expect(result.success).toBe(true);
  });

  it("increments immutable template versions", () => {
    expect(nextEventConfigurationTemplateVersion()).toBe(1);
    expect(nextEventConfigurationTemplateVersion(3)).toBe(4);
  });
});
