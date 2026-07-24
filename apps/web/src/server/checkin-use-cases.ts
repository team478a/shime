import { ConfirmCheckin, createDrizzleCheckinRepository } from "@shime/checkin";

const checkinRepository = createDrizzleCheckinRepository();

export const confirmCheckin = new ConfirmCheckin(checkinRepository);
