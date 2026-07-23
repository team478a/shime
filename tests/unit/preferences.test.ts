import { describe, expect, it } from "vitest";
import { detectMutualCandidates, findMatchConflicts, validatePreferenceChoices } from "@shime/core";
describe("preference modes", () => {
  it.each([
    ["mutual_up_to_2", 2],
    ["first_choice_only", 1],
    ["ranked_up_to_3", 3],
  ] as const)("enforces %s limit", (mode, count) => {
    const valid = Array.from({ length: count }, (_, i) => ({
      participantId: String(i),
      ...(mode === "ranked_up_to_3" ? { rank: i + 1 } : {}),
    }));
    expect(() => validatePreferenceChoices(mode, valid)).not.toThrow();
    expect(() =>
      validatePreferenceChoices(mode, [
        ...valid,
        { participantId: "extra", ...(mode === "ranked_up_to_3" ? { rank: count + 1 } : {}) },
      ]),
    ).toThrow("TOO_MANY_CHOICES");
  });
  it("rejects duplicate and missing ranks", () => {
    expect(() =>
      validatePreferenceChoices("ranked_up_to_3", [
        { participantId: "a", rank: 1 },
        { participantId: "b", rank: 1 },
      ]),
    ).toThrow("INVALID_RANKS");
  });
});
describe("mutual candidates", () => {
  it("returns only reciprocal choices in stable order", () => {
    expect(
      detectMutualCandidates([
        { fromParticipantId: "a", toParticipantId: "b", rank: 2 },
        { fromParticipantId: "b", toParticipantId: "a", rank: 1 },
        { fromParticipantId: "c", toParticipantId: "a", rank: null },
      ]),
    ).toEqual([{ participantAId: "a", participantBId: "b", aRank: 2, bRank: 1 }]);
  });
  it("warns about approved conflicts when multiple matches are disabled", () => {
    expect(
      findMatchConflicts(
        [
          { id: "1", participantAId: "a", participantBId: "b", status: "approved" },
          { id: "2", participantAId: "a", participantBId: "c", status: "approved" },
        ],
        false,
      ),
    ).toEqual([["1", "2"]]);
  });
});
