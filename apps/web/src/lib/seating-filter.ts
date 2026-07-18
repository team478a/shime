import { matchesCheckinSearch } from "@shime/core/checkin/search";

export type SeatingAssignmentFilter = "all" | "assigned" | "unassigned" | "locked";

export type SeatingAssignmentRow = Readonly<{
  participantId: string;
  seatId: string | null;
  locked: boolean;
}>;

export type SeatingParticipantRow = Readonly<{
  id: string;
  participantNumber: string | null;
  fullName: string;
}>;

export type SeatingSeatRow = Readonly<{
  id: string;
  tableCode: string;
  seatCode: string;
  enabled: boolean;
}>;

export type SeatingMapSeat = Readonly<{
  id: string;
  seatCode: string;
  participantId: string | null;
  participantNumber: string | null;
  fullName: string | null;
  locked: boolean;
}>;

export type SeatingMapTable = Readonly<{
  tableCode: string;
  seats: SeatingMapSeat[];
}>;

const seatingCodeCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

export function filterSeatingAssignments<T extends SeatingAssignmentRow>(
  assignments: T[],
  participants: SeatingParticipantRow[],
  query: string,
  filter: SeatingAssignmentFilter,
): T[] {
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const normalizedQuery = query.trim();
  return assignments.filter((assignment) => {
    if (filter === "assigned" && !assignment.seatId) return false;
    if (filter === "unassigned" && assignment.seatId) return false;
    if (filter === "locked" && !assignment.locked) return false;
    const participant = participantById.get(assignment.participantId);
    return Boolean(participant && (!normalizedQuery || matchesCheckinSearch(participant, normalizedQuery)));
  });
}

export function countChangedAssignments(initial: SeatingAssignmentRow[], current: SeatingAssignmentRow[]): number {
  const initialByParticipant = new Map(initial.map((assignment) => [assignment.participantId, assignment]));
  return current.filter((assignment) => {
    const before = initialByParticipant.get(assignment.participantId);
    return !before || before.seatId !== assignment.seatId || before.locked !== assignment.locked;
  }).length;
}

export function buildSeatingMap(
  seats: SeatingSeatRow[],
  assignments: SeatingAssignmentRow[],
  participants: SeatingParticipantRow[],
): SeatingMapTable[] {
  const assignmentBySeat = new Map(
    assignments
      .filter((assignment): assignment is SeatingAssignmentRow & { seatId: string } => Boolean(assignment.seatId))
      .map((assignment) => [assignment.seatId, assignment]),
  );
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const seatsByTable = new Map<string, SeatingMapSeat[]>();

  for (const seat of seats.filter((candidate) => candidate.enabled)) {
    const assignment = assignmentBySeat.get(seat.id);
    const participant = assignment ? participantById.get(assignment.participantId) : null;
    const mappedSeat: SeatingMapSeat = {
      id: seat.id,
      seatCode: seat.seatCode,
      participantId: assignment?.participantId ?? null,
      participantNumber: participant?.participantNumber ?? null,
      fullName: participant?.fullName ?? null,
      locked: assignment?.locked ?? false,
    };
    seatsByTable.set(seat.tableCode, [...(seatsByTable.get(seat.tableCode) ?? []), mappedSeat]);
  }

  return [...seatsByTable.entries()]
    .sort(([left], [right]) => seatingCodeCollator.compare(left, right))
    .map(([tableCode, tableSeats]) => ({
      tableCode,
      seats: tableSeats.sort((left, right) => seatingCodeCollator.compare(left.seatCode, right.seatCode)),
    }));
}
