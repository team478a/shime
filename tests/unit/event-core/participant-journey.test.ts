import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PARTICIPANT_JOURNEY,
  type ParticipantJourneyRepository,
  participantJourneyStepsSchema,
  PublishParticipantJourneyDraft,
  SaveParticipantJourneyDraft,
} from "@shime/event-core";

const scope = {
  tenantId: "tenant-1",
  eventId: "event-1",
  actorUserId: "user-1",
  requestId: "request-1",
  now: new Date("2026-07-25T00:00:00.000Z"),
};

describe("participant journey configuration", () => {
  it("allows Dream and questionnaire to exchange order before PASS", () => {
    const steps = [
      DEFAULT_PARTICIPANT_JOURNEY[1],
      DEFAULT_PARTICIPANT_JOURNEY[0],
      DEFAULT_PARTICIPANT_JOURNEY[2],
      DEFAULT_PARTICIPANT_JOURNEY[3],
    ];
    expect(participantJourneyStepsSchema.parse(steps)).toEqual(steps);
  });

  it("does not allow PASS before an enabled prerequisite", () => {
    const steps = [
      DEFAULT_PARTICIPANT_JOURNEY[2],
      DEFAULT_PARTICIPANT_JOURNEY[0],
      DEFAULT_PARTICIPANT_JOURNEY[1],
      DEFAULT_PARTICIPANT_JOURNEY[3],
    ];
    expect(participantJourneyStepsSchema.safeParse(steps).success).toBe(false);
  });

  it("keeps diagnosis disabled until its participant flow exists", () => {
    const steps = DEFAULT_PARTICIPANT_JOURNEY.map((step) =>
      step.id === "diagnosis" ? { ...step, enabled: true } : step,
    );
    expect(participantJourneyStepsSchema.safeParse(steps).success).toBe(false);
  });

  it("validates before saving a draft", async () => {
    const repository: ParticipantJourneyRepository = {
      getSettings: vi.fn(),
      saveDraft: vi.fn().mockResolvedValue({
        id: "version-1",
        version: 1,
        status: "draft",
        steps: DEFAULT_PARTICIPANT_JOURNEY,
        publishedAt: null,
        updatedAt: scope.now,
      }),
      publishDraft: vi.fn(),
    };
    await new SaveParticipantJourneyDraft(repository).execute({
      ...scope,
      steps: DEFAULT_PARTICIPANT_JOURNEY,
    });
    expect(repository.saveDraft).toHaveBeenCalledWith({
      ...scope,
      steps: DEFAULT_PARTICIPANT_JOURNEY,
    });
  });

  it("publishes only through the repository boundary", async () => {
    const repository: ParticipantJourneyRepository = {
      getSettings: vi.fn(),
      saveDraft: vi.fn(),
      publishDraft: vi.fn().mockResolvedValue(null),
    };
    await new PublishParticipantJourneyDraft(repository).execute(scope);
    expect(repository.publishDraft).toHaveBeenCalledWith(scope);
  });
});
