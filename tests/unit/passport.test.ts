import { describe, expect, it } from "vitest";
import {
  allocateParticipantNumber,
  createParticipantNumber,
  formatQrPayload,
  getParticipantNumberPrefix,
  isDreamRequirementSatisfied,
  parseQrPayload,
} from "@shime/core";
describe("passport rules", () => {
  it("requires a dream for required events", () => {
    expect(isDreamRequirementSatisfied("required_private_allowed", "confirmed")).toBe(true);
    expect(isDreamRequirementSatisfied("required_private_allowed", "skipped")).toBe(false);
  });
  it("allows optional skip", () => expect(isDreamRequirementSatisfied("optional", "skipped")).toBe(true));
  it("creates non-PII participant numbers", () => expect(createParticipantNumber("A", 4)).toMatch(/^A\d{4}$/));
  it("reads both stored participant number setting formats", () => {
    expect(getParticipantNumberPrefix({ groupAPrefix: "A", groupBPrefix: "B" }, "group_a")).toBe("A");
    expect(getParticipantNumberPrefix({ prefixes: { guest: "G" } }, "guest")).toBe("G");
  });
  it("allocates the lowest unused participant number deterministically", () => {
    expect(allocateParticipantNumber("A", 2, ["A01", "A03", null])).toBe("A02");
    expect(() =>
      allocateParticipantNumber(
        "A",
        2,
        Array.from({ length: 99 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`),
      ),
    ).toThrow("capacity exhausted");
  });
  it("puts only an opaque token into QR payloads", () => {
    const token = "a".repeat(43);
    const payload = formatQrPayload(token);
    expect(payload).toBe(`SHIME1:${token}`);
    expect(parseQrPayload(payload)).toBe(token);
    expect(payload).not.toContain("Dream");
  });
});
