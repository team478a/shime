import { AssignParticipantNumber, ConfirmCheckin, createDrizzleCheckinRepository } from "@shime/checkin";

const checkinRepository = createDrizzleCheckinRepository();

export const confirmCheckin = new ConfirmCheckin(checkinRepository);
export const assignParticipantNumber = new AssignParticipantNumber(checkinRepository);
