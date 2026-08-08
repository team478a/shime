import type { SeatingRepository } from "./seating-repository";
import type { SeatingScope } from "./seating-types";

export class GetPublishedParticipantSeat {
  constructor(private readonly repository: SeatingRepository) {}

  execute(scope: SeatingScope, participantId: string) {
    return this.repository.getPublishedParticipantSeat(scope, participantId);
  }
}
