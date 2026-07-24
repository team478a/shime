import {
  createDrizzleParticipantJourneyRepository,
  GetParticipantJourneySettings,
  PublishParticipantJourneyDraft,
  SaveParticipantJourneyDraft,
} from "@shime/event-core";

const repository = createDrizzleParticipantJourneyRepository();

export const getParticipantJourneySettings = new GetParticipantJourneySettings(repository);
export const saveParticipantJourneyDraft = new SaveParticipantJourneyDraft(repository);
export const publishParticipantJourneyDraft = new PublishParticipantJourneyDraft(repository);
