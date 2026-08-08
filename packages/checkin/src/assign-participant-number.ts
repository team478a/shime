import { normalizeParticipantNumber } from "@shime/core/passport/rules";

import type { CheckinRepository } from "./checkin-repository";
import type { AssignParticipantNumberInput, AssignParticipantNumberResult } from "./checkin-types";

export class AssignParticipantNumber {
  constructor(private readonly repository: CheckinRepository) {}

  async execute(input: AssignParticipantNumberInput): Promise<AssignParticipantNumberResult> {
    const result = await this.repository.assignParticipantNumber({
      ...input,
      participantNumber: normalizeParticipantNumber(input.participantNumber),
    });

    if (result.outcome === "assigned") return { ok: true, data: { participantNumber: result.participantNumber } };
    if (result.outcome === "not_found") return { ok: false, code: "NOT_FOUND", status: 404 };
    if (result.outcome === "automatic_mode") return { ok: false, code: "MANUAL_NUMBERING_DISABLED", status: 409 };
    if (result.outcome === "invalid_format") return { ok: false, code: "INVALID_PARTICIPANT_NUMBER", status: 422 };
    return { ok: false, code: "PARTICIPANT_NUMBER_DUPLICATE", status: 409 };
  }
}
