import { describe, expect, it } from "vitest";
import { matchesCheckinSearch, normalizeCheckinSearchQuery } from "@shime/core";

const candidate = { participantNumber: "A01", fullName: "テスト 参加者A01" };

describe("manual check-in search", () => {
  it("matches a participant-number prefix without case or width sensitivity", () => {
    expect(matchesCheckinSearch(candidate, "A")).toBe(true);
    expect(matchesCheckinSearch(candidate, "a0")).toBe(true);
    expect(matchesCheckinSearch(candidate, "Ａ０１")).toBe(true);
  });

  it("matches a short part of a name while ignoring spaces", () => {
    expect(matchesCheckinSearch(candidate, "参加者")).toBe(true);
    expect(matchesCheckinSearch(candidate, "テスト参加")).toBe(true);
    expect(matchesCheckinSearch(candidate, "別の氏名")).toBe(false);
  });

  it("rejects an empty normalized query", () => {
    expect(normalizeCheckinSearchQuery(" 　 ")).toBe("");
    expect(matchesCheckinSearch(candidate, " 　 ")).toBe(false);
  });
});
