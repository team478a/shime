export type SeatingCandidate = { id: string; category: string; checkedIn: boolean; answerKey: string };
export type SeatingSeat = { id: string; tableId: string; order: number };
export type SeatingPair = { a: string; b: string; score: number; sharedTopicCount: number };
export type LockedAssignment = { participantId: string; seatId: string };

export function buildDeterministicAssignments(input: { candidates: SeatingCandidate[]; seats: SeatingSeat[]; pairs: SeatingPair[]; allowedCategoryPairs: string[][]; blockedPairs: string[][]; locked?: LockedAssignment[] }) {
  const eligible = input.candidates.filter((p) => p.checkedIn).sort((a, b) => a.id.localeCompare(b.id));
  const seatById = new Map(input.seats.map((s) => [s.id, s]));
  const usedPeople = new Set<string>(); const usedSeats = new Set<string>(); const assignments: LockedAssignment[] = [];
  for (const lock of [...(input.locked ?? [])].sort((a, b) => a.seatId.localeCompare(b.seatId))) {
    if (seatById.has(lock.seatId) && eligible.some((p) => p.id === lock.participantId) && !usedPeople.has(lock.participantId) && !usedSeats.has(lock.seatId)) { assignments.push(lock); usedPeople.add(lock.participantId); usedSeats.add(lock.seatId); }
  }
  const blocked = new Set(input.blockedPairs.map(([a, b]) => [a, b].sort().join(":")));
  const allowed = new Set(input.allowedCategoryPairs.map(([a, b]) => [a, b].sort().join(":")));
  const person = new Map(eligible.map((p) => [p.id, p]));
  const ranked = input.pairs.filter((pair) => {
    const a = person.get(pair.a), b = person.get(pair.b); return a && b && !blocked.has([pair.a, pair.b].sort().join(":")) && allowed.has([a.category, b.category].sort().join(":"));
  }).sort((a, b) => b.score - a.score || b.sharedTopicCount - a.sharedTopicCount || [a.a, a.b].sort().join(":").localeCompare([b.a, b.b].sort().join(":")));
  const freeByTable = [...input.seats].filter((s) => !usedSeats.has(s.id)).sort((a, b) => a.tableId.localeCompare(b.tableId) || a.order - b.order);
  for (const pair of ranked) {
    if (usedPeople.has(pair.a) || usedPeople.has(pair.b)) continue;
    const tables = [...new Set(freeByTable.map((s) => s.tableId))].sort();
    const table = tables.find((id) => freeByTable.filter((s) => s.tableId === id && !usedSeats.has(s.id)).length >= 2); if (!table) break;
    const free = freeByTable.filter((s) => s.tableId === table && !usedSeats.has(s.id)).slice(0, 2);
    for (const [participantId, seat] of [[pair.a, free[0]], [pair.b, free[1]]] as const) { assignments.push({ participantId, seatId: seat!.id }); usedPeople.add(participantId); usedSeats.add(seat!.id); }
  }
  return { assignments, unassignedParticipantIds: eligible.filter((p) => !usedPeople.has(p.id)).map((p) => p.id), warnings: eligible.length > input.seats.length ? ["SEAT_CAPACITY_SHORTAGE"] : [] };
}
