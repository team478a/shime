import { describe, expect, it } from "vitest";

import { validateConciergeTemplateForPublish } from "@shime/core";

import {
  CONCIERGE_REHEARSAL_CARDS,
  createConciergeRehearsalPayload,
  parseConciergeRehearsalArgs,
} from "../../scripts/concierge-rehearsal-config";

const cardIds = Array.from({ length: 8 }, (_, index) => `0000000${index}-0000-4000-8000-000000000000`);

describe("concierge rehearsal setup configuration", () => {
  it("defaults to dry-run and accepts only isolated rehearsal event codes", () => {
    expect(parseConciergeRehearsalArgs(["--event-code", "rh-a-20260715"])).toEqual({
      apply: false,
      eventCode: "rh-a-20260715",
    });
    expect(parseConciergeRehearsalArgs(["--apply", "--event-code", "rh-b-20260715"])).toEqual({
      apply: true,
      eventCode: "rh-b-20260715",
    });
  });

  it("rejects production-like or missing event codes", () => {
    expect(() => parseConciergeRehearsalArgs(["--event-code", "event-20260808"])).toThrow(
      "REHEARSAL_EVENT_CODE_REQUIRED",
    );
    expect(() => parseConciergeRehearsalArgs([])).toThrow("REHEARSAL_EVENT_CODE_REQUIRED");
  });

  it("builds a publishable four-axis, eight-emotion, eight-card template", () => {
    const payload = createConciergeRehearsalPayload(cardIds);
    expect(payload.questions).toHaveLength(4);
    expect(payload.emotions).toHaveLength(8);
    expect(payload.cardMappings).toHaveLength(8);
    expect(payload.emotions.map((emotion) => emotion.code)).toEqual(CONCIERGE_REHEARSAL_CARDS.map((card) => card.code));
    expect(validateConciergeTemplateForPublish(payload)).toEqual([]);
  });
});
