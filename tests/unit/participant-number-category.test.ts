import { describe, expect, it } from "vitest";

import { resolveParticipantNumberForCategory } from "@shime/core/passport/rules";

describe("resolveParticipantNumberForCategory", () => {
  it.each([
    ["1", "A", 2, "A01"],
    ["１", "B", 2, "B01"],
    ["16", "A", 2, "A16"],
    ["B06", "B", 2, "B06"],
  ])("resolves %s for category prefix %s", (value, prefix, digits, expected) => {
    expect(resolveParticipantNumberForCategory(value, prefix, digits)).toBe(expected);
  });

  it("does not silently wrap a number outside the configured range", () => {
    expect(resolveParticipantNumberForCategory("100", "A", 2)).toBe("100");
  });
});
