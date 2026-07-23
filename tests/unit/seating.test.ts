import { describe, expect, it } from "vitest";
import { buildDeterministicAssignments, scorePair } from "@shime/core";
const config = {
  weights: { values: 40, marriage_intent: 25, relationship_pace: 15, conversation_style: 10, topic_overlap: 10 },
  maxOrdinalDistance: { marriage_intent: 4, relationship_pace: 3 },
  paceFlexibleCode: "flexible",
  conversationComplement: { talker: { listener: 1, talker: 0.4 } },
};
describe("seating score", () => {
  it("normalizes weights after declined axes", () => {
    const result = scorePair(
      { values: { selections: ["a", "b"] }, marriage_intent: { selections: [], declined: true } },
      { values: { selections: ["a"] }, marriage_intent: { selections: [], ordinal: 2 } },
      config,
    );
    expect(result.total).toBe(50);
    expect(result.normalizedWeights.values).toBe(100);
  });
  it("scores all five axes deterministically", () => {
    const answer = {
      values: { selections: ["family"] },
      marriage_intent: { selections: [], ordinal: 3 },
      relationship_pace: { selections: ["slow"], ordinal: 2 },
      conversation_style: { selections: ["talker"] },
      topic_overlap: { selections: ["food", "travel"] },
    };
    const other = {
      ...answer,
      conversation_style: { selections: ["listener"] },
      topic_overlap: { selections: ["travel"] },
    };
    expect(scorePair(answer, other, config)).toEqual(scorePair(answer, other, config));
    expect(scorePair(answer, other, config).total).toBe(100);
  });
});
describe("seating assignment", () => {
  it("obeys blocks, category pairs and stable tie breaks", () => {
    const input = {
      candidates: [
        { id: "a", category: "A", checkedIn: true, answerKey: "a" },
        { id: "b", category: "B", checkedIn: true, answerKey: "b" },
        { id: "c", category: "B", checkedIn: true, answerKey: "c" },
      ],
      seats: [
        { id: "1", tableId: "t", order: 1 },
        { id: "2", tableId: "t", order: 2 },
      ],
      pairs: [
        { a: "a", b: "b", score: 90, sharedTopicCount: 1 },
        { a: "a", b: "c", score: 80, sharedTopicCount: 1 },
      ],
      allowedCategoryPairs: [["A", "B"]],
      blockedPairs: [["a", "b"]],
    };
    const result = buildDeterministicAssignments(input);
    expect(result.assignments.map((x) => x.participantId)).toEqual(["a", "c"]);
    expect(result.unassignedParticipantIds).toEqual(["b"]);
  });
});
