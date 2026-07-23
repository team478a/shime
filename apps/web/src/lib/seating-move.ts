export type MovableSeatAssignment = { participantId: string; seatId: string | null; locked: boolean };

export type SeatMoveResult =
  | { ok: true; assignments: MovableSeatAssignment[]; swappedParticipantId: string | null }
  | { ok: false; code: "SOURCE_NOT_FOUND" | "SOURCE_LOCKED" | "TARGET_LOCKED" | "NO_CHANGE" };

export function moveParticipantToSeat(
  assignments: MovableSeatAssignment[],
  participantId: string,
  targetSeatId: string | null,
): SeatMoveResult {
  const source = assignments.find((assignment) => assignment.participantId === participantId);
  if (!source) return { ok: false, code: "SOURCE_NOT_FOUND" };
  if (source.locked) return { ok: false, code: "SOURCE_LOCKED" };
  if (source.seatId === targetSeatId) return { ok: false, code: "NO_CHANGE" };
  const target = targetSeatId ? assignments.find((assignment) => assignment.seatId === targetSeatId) : undefined;
  if (target?.locked) return { ok: false, code: "TARGET_LOCKED" };
  const sourceSeatId = source.seatId;
  return {
    ok: true,
    swappedParticipantId: target?.participantId ?? null,
    assignments: assignments.map((assignment) => {
      if (assignment.participantId === participantId) return { ...assignment, seatId: targetSeatId };
      if (target && assignment.participantId === target.participantId) return { ...assignment, seatId: sourceSeatId };
      return assignment;
    }),
  };
}
