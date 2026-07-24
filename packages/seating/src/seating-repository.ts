import type { SeatAssignment, SeatingParticipant, SeatingRun, SeatingScope, SeatingSeat } from "./seating-types";

export interface SeatingRepository {
  listRuns(scope: SeatingScope): Promise<SeatingRun[]>;
  listAssignments(scope: SeatingScope, seatingRunIds: string[]): Promise<SeatAssignment[]>;
  listParticipants(scope: SeatingScope): Promise<SeatingParticipant[]>;
  listSeats(scope: SeatingScope): Promise<SeatingSeat[]>;
}
