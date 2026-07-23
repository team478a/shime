import { describe, expect, it } from "vitest";

import { isQuestionnaireComplete } from "../../apps/web/src/lib/participant-questionnaire";

describe("participant questionnaire completeness", () => {
  it("requires every question to have a selected option or an explicit decline", () => {
    expect(
      isQuestionnaireComplete(["q1", "q2"], {
        q1: { questionId: "q1", optionCodes: ["a"], declined: false },
        q2: { questionId: "q2", optionCodes: [], declined: true },
      }),
    ).toBe(true);
  });

  it("rejects an empty answer object left after deselecting an option", () => {
    expect(
      isQuestionnaireComplete(["q1"], {
        q1: { questionId: "q1", optionCodes: [], declined: false },
      }),
    ).toBe(false);
  });

  it("rejects missing questions and an unconfigured questionnaire", () => {
    expect(
      isQuestionnaireComplete(["q1", "q2"], {
        q1: { questionId: "q1", optionCodes: ["a"], declined: false },
      }),
    ).toBe(false);
    expect(isQuestionnaireComplete([], {})).toBe(false);
  });
});
