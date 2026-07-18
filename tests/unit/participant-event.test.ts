import { describe, expect, it } from "vitest";

import { formatParticipantEventDate, getParticipantEventStatusLabel } from "../../apps/web/src/lib/participant-event";

describe("participant event context", () => {
  it("uses participant-friendly event status labels", () => {
    expect(getParticipantEventStatusLabel("checkin_open")).toBe("当日受付中");
    expect(getParticipantEventStatusLabel("result_confirmed")).toBe("ご案内公開中");
    expect(getParticipantEventStatusLabel("unknown")).toBe("イベント情報確認中");
  });

  it("displays event timestamps in Asia/Tokyo", () => {
    expect(formatParticipantEventDate("2026-08-08T05:00:00.000Z")).toContain("2026年8月8日");
    expect(formatParticipantEventDate("2026-08-08T05:00:00.000Z")).toContain("14:00");
  });
});
