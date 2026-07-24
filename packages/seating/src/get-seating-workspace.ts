import type { SeatingRepository } from "./seating-repository";
import type { SeatingScope, SeatingWorkspace } from "./seating-types";

export class GetSeatingWorkspace {
  constructor(private readonly repository: SeatingRepository) {}

  async execute(scope: SeatingScope): Promise<SeatingWorkspace> {
    const runs = await this.repository.listRuns(scope);
    const assignments =
      runs.length > 0
        ? await this.repository.listAssignments(
            scope,
            runs.map((run) => run.id),
          )
        : [];
    const [participants, seats] = await Promise.all([
      this.repository.listParticipants(scope),
      this.repository.listSeats(scope),
    ]);

    return {
      runs: runs.map((run) => ({
        ...run,
        assignments: assignments.filter((assignment) => assignment.seatingRunId === run.id),
      })),
      participants,
      seats,
    };
  }
}
