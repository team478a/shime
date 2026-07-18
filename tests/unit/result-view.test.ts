import { describe, expect, it } from "vitest";
import { filterResultCandidates, resultStatusClass, summarizeResultCandidates } from "../../apps/web/src/lib/result-view";

describe("result view helpers", () => {
  it("summarizes approved, pending, and declined candidates", () => {
    expect(summarizeResultCandidates([
      { status: "approved" },
      { status: "pending" },
      { status: "declined" },
      { status: "approved" },
    ])).toEqual({ total: 4, approved: 2, pending: 1, declined: 1 });
  });

  it("treats an unknown status as pending for safe display", () => {
    expect(summarizeResultCandidates([{ status: "unknown" }]).pending).toBe(1);
    expect(resultStatusClass("unknown")).toBe("result-status-pending");
  });

  it("filters by short participant prefix, partial name, and status", () => {
    const people = [
      { id: "a", participantNumber: "A01", fullName: "山田 花子" },
      { id: "b", participantNumber: "B01", fullName: "佐藤太郎" },
      { id: "c", participantNumber: "A02", fullName: "田中美咲" },
    ];
    const candidates = [
      { id: "1", participantAId: "a", participantBId: "b", status: "approved" },
      { id: "2", participantAId: "c", participantBId: "b", status: "pending" },
    ];
    expect(filterResultCandidates(candidates, people, "A01", "all").map((item) => item.id)).toEqual(["1"]);
    expect(filterResultCandidates(candidates, people, "山田花", "all").map((item) => item.id)).toEqual(["1"]);
    expect(filterResultCandidates(candidates, people, "", "pending").map((item) => item.id)).toEqual(["2"]);
  });
});
