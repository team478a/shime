import { describe, expect, it } from "vitest";
import { filterParticipantLinkRows } from "../../apps/web/src/lib/participant-link-filter";

const rows = [
  { id: "1", participantNumber: "A01", fullName: "テスト参加者A01", linked: true },
  { id: "2", participantNumber: "A02", fullName: "テスト参加者A02", linked: false },
  { id: "3", participantNumber: "B01", fullName: "別の参加者", linked: false },
];

describe("participant link filters", () => {
  it("uses the same short number and name search as check-in", () => {
    expect(filterParticipantLinkRows(rows, "A", "all").map((row) => row.id)).toEqual(["1", "2"]);
    expect(filterParticipantLinkRows(rows, "別の", "all").map((row) => row.id)).toEqual(["3"]);
  });

  it("filters linked and unlinked participants without more typing", () => {
    expect(filterParticipantLinkRows(rows, "", "linked").map((row) => row.id)).toEqual(["1"]);
    expect(filterParticipantLinkRows(rows, "", "unlinked").map((row) => row.id)).toEqual(["2", "3"]);
  });
});
