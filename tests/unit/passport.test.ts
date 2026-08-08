import { describe, expect, it } from "vitest";
import {
  allocateParticipantNumber,
  createParticipantNumber,
  formatQrPayload,
  getParticipantNumberAssignmentMode,
  getParticipantNumberPrefix,
  isDreamRequirementSatisfied,
  isParticipantNumberForCategory,
  parseQrPayload,
} from "@shime/core";
describe("passport rules", () => {
  it("requires a dream for required events", () => {
    expect(isDreamRequirementSatisfied("required_private_allowed", "confirmed")).toBe(true);
    expect(isDreamRequirementSatisfied("required_private_allowed", "skipped")).toBe(false);
  });
  it.each(["not_started", "drafting", "confirmed", "skipped"] as const)(
    "does not block PASS when Dream is optional (%s)",
    (state) => expect(isDreamRequirementSatisfied("optional", state)).toBe(true),
  );
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
  it("defaults to automatic numbering and recognizes manual mode", () => {
    expect(getParticipantNumberAssignmentMode({})).toBe("automatic");
    expect(getParticipantNumberAssignmentMode({ participantNumberAssignmentMode: "manual" })).toBe("manual");
  });
  it("normalizes and validates category-specific manual numbers", () => {
    expect(isParticipantNumberForCategory("ａ０１", "A", 2)).toBe(true);
    expect(isParticipantNumberForCategory("B01", "A", 2)).toBe(false);
    expect(isParticipantNumberForCategory("A1", "A", 2)).toBe(false);
  });
  it("puts only an opaque token into QR payloads", () => {
    const token = "a".repeat(43);
    const payload = formatQrPayload(token);
    expect(payload).toBe(`SHIME1:${token}`);
    expect(parseQrPayload(payload)).toBe(token);
    expect(payload).not.toContain("Dream");
  });
});
