import type { CheckinRepository } from "./checkin-repository";
import type { ConfirmCheckinInput, ConfirmCheckinResult } from "./checkin-types";

export class ConfirmCheckin {
  constructor(private readonly repository: CheckinRepository) {}

  async execute(input: ConfirmCheckinInput): Promise<ConfirmCheckinResult> {
    const result = await this.repository.confirm(input);

    if (result.outcome === "not_found") {
      return { ok: false, code: "NOT_FOUND", status: 404 };
    }
    if (result.outcome === "already_checked_in") {
      return {
        ok: false,
        code: "ALREADY_CHECKED_IN",
        status: 409,
        data: { checkedInAt: result.checkedInAt },
      };
    }
    return { ok: true, data: result.checkin };
  }
}
