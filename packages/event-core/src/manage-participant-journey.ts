import type { ParticipantJourneyRepository } from "./participant-journey-repository";
import {
  type ParticipantJourneySettings,
  type ParticipantJourneyStep,
  participantJourneyStepsSchema,
  type ParticipantJourneyVersion,
} from "./participant-journey-types";

export class GetParticipantJourneySettings {
  constructor(private readonly repository: ParticipantJourneyRepository) {}

  execute(input: { tenantId: string; eventId: string }): Promise<ParticipantJourneySettings | null> {
    return this.repository.getSettings(input);
  }
}

export class SaveParticipantJourneyDraft {
  constructor(private readonly repository: ParticipantJourneyRepository) {}

  async execute(input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    requestId: string;
    steps: unknown;
    now: Date;
  }): Promise<ParticipantJourneyVersion | null> {
    const steps: ParticipantJourneyStep[] = participantJourneyStepsSchema.parse(input.steps);
    return this.repository.saveDraft({ ...input, steps });
  }
}

export class PublishParticipantJourneyDraft {
  constructor(private readonly repository: ParticipantJourneyRepository) {}

  async execute(input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    requestId: string;
    now: Date;
  }): Promise<ParticipantJourneyVersion | null> {
    const settings = await this.repository.getSettings(input);
    if (
      settings?.draft?.steps.some((step) => step.id === "diagnosis" && step.enabled) &&
      !(await this.repository.isDiagnosisAvailable(input))
    ) {
      throw new DiagnosisJourneyUnavailableError();
    }
    return this.repository.publishDraft(input);
  }
}

export class DiagnosisJourneyUnavailableError extends Error {
  constructor() {
    super("DIAGNOSIS_JOURNEY_UNAVAILABLE");
    this.name = "DiagnosisJourneyUnavailableError";
  }
}
