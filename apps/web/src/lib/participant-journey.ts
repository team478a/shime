import {
  DEFAULT_PARTICIPANT_JOURNEY,
  type ParticipantJourneyStep,
  type ParticipantJourneyStepId,
} from "@shime/event-core/participant-journey-types";

export type ParticipantJourneyKey = ParticipantJourneyStepId | "preference" | "result";

const PARTICIPANT_JOURNEY_PATHS: Record<ParticipantJourneyKey, string> = {
  dream: "dream",
  questionnaire: "questionnaire",
  diagnosis: "diagnosis",
  pass: "passport",
  preference: "preferences",
  result: "result",
};

const PARTICIPANT_JOURNEY_LABELS: Record<ParticipantJourneyKey, string> = {
  dream: "Dream",
  questionnaire: "5問",
  diagnosis: "診断",
  pass: "PASS",
  preference: "希望",
  result: "結果",
};

export function getParticipantJourney(configured: ParticipantJourneyStep[] = DEFAULT_PARTICIPANT_JOURNEY) {
  return [
    ...configured
      .filter((stage) => stage.enabled)
      .map((stage) => ({
        key: stage.id as ParticipantJourneyKey,
        label: PARTICIPANT_JOURNEY_LABELS[stage.id],
      })),
    { key: "preference" as const, label: PARTICIPANT_JOURNEY_LABELS.preference },
    { key: "result" as const, label: PARTICIPANT_JOURNEY_LABELS.result },
  ];
}

export const PARTICIPANT_JOURNEY = getParticipantJourney();

export function buildParticipantJourneyUrl(stage: ParticipantJourneyKey, eventId: string): string {
  return `/liff/${PARTICIPANT_JOURNEY_PATHS[stage]}?${new URLSearchParams({ eventId }).toString()}`;
}
