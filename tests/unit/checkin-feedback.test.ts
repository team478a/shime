import { describe, expect, it } from "vitest";

import { getCheckinSearchFailure } from "../../apps/web/src/lib/checkin-feedback";

describe("check-in search feedback", () => {
  it("guides an expired session back to login", () => {
    expect(getCheckinSearchFailure(401)).toEqual({
      message: "ログインの有効期限が切れました。再ログインしてください。",
      requiresLogin: true,
    });
  });

  it("distinguishes permission and communication failures", () => {
    expect(getCheckinSearchFailure(403).requiresLogin).toBe(false);
    expect(getCheckinSearchFailure(403).message).toContain("受付権限");
    expect(getCheckinSearchFailure(500).message).toContain("通信状態");
  });
});
