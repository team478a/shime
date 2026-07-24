import { createDrizzleSeatingRepository, GetSeatingWorkspace } from "@shime/seating";

const seatingRepository = createDrizzleSeatingRepository();

export const getSeatingWorkspace = new GetSeatingWorkspace(seatingRepository);
