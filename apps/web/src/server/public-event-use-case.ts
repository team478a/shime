import { createDrizzlePublicEventRepository, GetPublicEvent } from "@shime/event-core";

export const getPublicEvent = new GetPublicEvent(createDrizzlePublicEventRepository());
