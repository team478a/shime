import { describe, expect, it } from "vitest";

import { buildParticipantJourneyUrl, PARTICIPANT_JOURNEY } from "../../apps/web/src/lib/participant-journey";

describe("participant journey", () => {
  it("keeps the participant-only flow in the approved order", () => {
    expect(PARTICIPANT_JOURNEY.map((stage) => stage.key)).toEqual([
      "dream",
      "questionnaire",
      "pass",
      "preference",
      "result",
    ]);
  });

  it("uses the common PASS label instead of a service-specific passport label", () => {
    expect(PARTICIPANT_JOURNEY.find((stage) => stage.key === "pass")?.label).toBe("PASS");
  });

  it("keeps the event context when continuing from LINE linkage", () => {
    expect(buildParticipantJourneyUrl("dream", "event id")).toBe("/liff/dream?eventId=event+id");
    expect(buildParticipantJourneyUrl("pass", "event-1")).toBe("/liff/passport?eventId=event-1");
  });
});
