import { describe, expect, it } from "vitest";

import { moveParticipantToSeat } from "../../apps/web/src/lib/seating-move";

const assignments = [
  { participantId: "p1", seatId: "s1", locked: false },
  { participantId: "p2", seatId: "s2", locked: false },
  { participantId: "p3", seatId: null, locked: false },
];

describe("visual seating moves", () => {
  it("moves a participant to an empty seat without duplicates", () => {
    const result = moveParticipantToSeat(assignments, "p1", "s3");
    expect(result.ok && result.assignments.find((item) => item.participantId === "p1")?.seatId).toBe("s3");
  });

  it("swaps occupants when the destination is occupied", () => {
    const result = moveParticipantToSeat(assignments, "p1", "s2");
    expect(result.ok && result.assignments.map((item) => item.seatId)).toEqual(["s2", "s1", null]);
  });

  it("does not move a locked participant or displace a locked occupant", () => {
    expect(moveParticipantToSeat([{ ...assignments[0]!, locked: true }], "p1", "s2")).toEqual({
      ok: false,
      code: "SOURCE_LOCKED",
    });
    expect(moveParticipantToSeat([{ ...assignments[0]! }, { ...assignments[1]!, locked: true }], "p1", "s2")).toEqual({
      ok: false,
      code: "TARGET_LOCKED",
    });
  });
});
