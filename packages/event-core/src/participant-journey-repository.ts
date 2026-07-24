import type {
  ParticipantJourneySettings,
  ParticipantJourneyStep,
  ParticipantJourneyVersion,
} from "./participant-journey-types";

export type JourneyScope = {
  tenantId: string;
  eventId: string;
};

export interface ParticipantJourneyRepository {
  getSettings(scope: JourneyScope): Promise<ParticipantJourneySettings | null>;
  saveDraft(
    scope: JourneyScope & {
      actorUserId: string;
      requestId: string;
      steps: ParticipantJourneyStep[];
      now: Date;
    },
  ): Promise<ParticipantJourneyVersion | null>;
  publishDraft(
    scope: JourneyScope & {
      actorUserId: string;
      requestId: string;
      now: Date;
    },
  ): Promise<ParticipantJourneyVersion | null>;
}
