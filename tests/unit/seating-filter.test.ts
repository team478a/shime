import { describe, expect, it } from "vitest";

import {
  buildSeatingMap,
  countChangedAssignments,
  filterSeatingAssignments,
} from "../../apps/web/src/lib/seating-filter";

const participants = [
  { id: "p1", participantNumber: "A01", fullName: "佐藤 花子" },
  { id: "p2", participantNumber: "A02", fullName: "鈴木 太郎" },
  { id: "p3", participantNumber: "B01", fullName: "山田 次郎" },
];
const assignments = [
  { participantId: "p1", seatId: "s1", locked: false },
  { participantId: "p2", seatId: null, locked: false },
  { participantId: "p3", seatId: "s2", locked: true },
];

describe("seating assignment filters", () => {
  it("uses participant-number prefix and partial-name search", () => {
    expect(filterSeatingAssignments(assignments, participants, "A", "all")).toHaveLength(2);
    expect(filterSeatingAssignments(assignments, participants, "山田", "all").map((row) => row.participantId)).toEqual([
      "p3",
    ]);
  });

  it("filters assignment state", () => {
    expect(filterSeatingAssignments(assignments, participants, "", "assigned")).toHaveLength(2);
    expect(
      filterSeatingAssignments(assignments, participants, "", "unassigned").map((row) => row.participantId),
    ).toEqual(["p2"]);
    expect(filterSeatingAssignments(assignments, participants, "", "locked").map((row) => row.participantId)).toEqual([
      "p3",
    ]);
  });

  it("counts only changed seats and locks", () => {
    expect(countChangedAssignments(assignments, assignments)).toBe(0);
    expect(
      countChangedAssignments(assignments, [
        { ...assignments[0]!, seatId: "s3" },
        assignments[1]!,
        { ...assignments[2]!, locked: false },
      ]),
    ).toBe(2);
  });

  it("builds a stable table map with occupied, locked, and empty seats", () => {
    const map = buildSeatingMap(
      [
        { id: "s3", tableCode: "T02", seatCode: "T02-1", enabled: true },
        { id: "s2", tableCode: "T01", seatCode: "T01-2", enabled: true },
        { id: "s1", tableCode: "T01", seatCode: "T01-1", enabled: true },
        { id: "disabled", tableCode: "T01", seatCode: "T01-3", enabled: false },
      ],
      assignments,
      participants,
    );

    expect(map.map((table) => table.tableCode)).toEqual(["T01", "T02"]);
    expect(map[0]?.seats).toEqual([
      {
        id: "s1",
        seatCode: "T01-1",
        participantId: "p1",
        participantNumber: "A01",
        fullName: "佐藤 花子",
        locked: false,
      },
      {
        id: "s2",
        seatCode: "T01-2",
        participantId: "p3",
        participantNumber: "B01",
        fullName: "山田 次郎",
        locked: true,
      },
    ]);
    expect(map[1]?.seats[0]).toMatchObject({ seatCode: "T02-1", participantId: null, locked: false });
  });
});
