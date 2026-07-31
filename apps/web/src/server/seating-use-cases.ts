import { createDrizzleSeatingRepository, GetPublishedParticipantSeat, GetSeatingWorkspace } from "@shime/seating";

const seatingRepository = createDrizzleSeatingRepository();

export const getSeatingWorkspace = new GetSeatingWorkspace(seatingRepository);
export const getPublishedParticipantSeat = new GetPublishedParticipantSeat(seatingRepository);
