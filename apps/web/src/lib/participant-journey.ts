export const PARTICIPANT_JOURNEY = [
  { key: "dream", label: "Dream" },
  { key: "questionnaire", label: "5問" },
  { key: "pass", label: "PASS" },
  { key: "preference", label: "希望" },
  { key: "result", label: "結果" },
] as const;

export type ParticipantJourneyKey = (typeof PARTICIPANT_JOURNEY)[number]["key"];

const PARTICIPANT_JOURNEY_PATHS: Record<ParticipantJourneyKey, string> = {
  dream: "dream",
  questionnaire: "questionnaire",
  pass: "passport",
  preference: "preferences",
  result: "result",
};

export function buildParticipantJourneyUrl(stage: ParticipantJourneyKey, eventId: string): string {
  return `/liff/${PARTICIPANT_JOURNEY_PATHS[stage]}?${new URLSearchParams({ eventId }).toString()}`;
}
