import { describe, expect, it } from "vitest";

import {
  EVENT_STATUSES,
  getEventStatusLabel,
  getMatchCandidateStatusLabel,
  getParticipantStatusLabel,
  getPassportStatusLabel,
} from "../../apps/web/src/lib/status-labels";

describe("status labels", () => {
  it("provides a Japanese label for every event status", () => {
    for (const status of EVENT_STATUSES) {
      expect(getEventStatusLabel(status)).not.toBe(status);
      expect(getEventStatusLabel(status)).not.toBe("未定義の状態");
    }
  });

  it("labels participant and passport states used on event day", () => {
    expect(getParticipantStatusLabel("confirmed")).toBe("参加確定");
    expect(getParticipantStatusLabel("attended")).toBe("来場済み");
    expect(getPassportStatusLabel("ready")).toBe("受付準備完了");
    expect(getPassportStatusLabel("checked_in")).toBe("受付済み");
  });

  it("labels manager-only match candidate states", () => {
    expect(getMatchCandidateStatusLabel("candidate")).toBe("成立候補");
    expect(getMatchCandidateStatusLabel("approved")).toBe("承認");
    expect(getMatchCandidateStatusLabel("revoked")).toBe("承認取消");
  });

  it("does not expose an unknown internal code to the UI", () => {
    expect(getEventStatusLabel("unexpected_internal_code")).toBe("未定義の状態");
  });
});
