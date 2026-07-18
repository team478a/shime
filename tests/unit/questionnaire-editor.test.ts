import { describe, expect, it } from "vitest";
import { questionnaireEditorIssues, type QuestionnaireQuestionDraft } from "../../apps/web/src/lib/questionnaire-editor";

const valid = [
  ["values", 40], ["marriage_intent", 25], ["relationship_pace", 15], ["conversation_style", 10], ["topic_overlap", 10],
].map(([axis, weight]) => ({ axis, weight, prompt: "質問", kind: "ordinal", maxSelections: 1, options: [{ code: "1", label: "A", scoreValue: 1 }, { code: "2", label: "B", scoreValue: 2 }] })) as QuestionnaireQuestionDraft[];

describe("questionnaire editor validation", () => {
  it("accepts five unique axes with total weight 100", () => {
    expect(questionnaireEditorIssues(valid)).toEqual([]);
  });

  it("reports weight, option-code duplication, and max-selection problems", () => {
    const invalid = structuredClone(valid);
    const first = invalid[0];
    if (!first || !first.options[1]) throw new Error("test fixture is incomplete");
    first.weight = 39;
    first.maxSelections = 3;
    first.options[1].code = "1";
    const issues = questionnaireEditorIssues(invalid).join("\n");
    expect(issues).toContain("現在 99");
    expect(issues).toContain("重複");
    expect(issues).toContain("最大選択数");
  });
});
