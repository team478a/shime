import { describe, expect, it } from "vitest";
import { hasValidBearerSecret, notificationFailureCode } from "../../apps/web/src/server/operational-security";

describe("internal job authentication", () => {
  const secret = "a-secure-internal-job-secret-with-32-chars";

  it("accepts only the exact bearer secret", () => {
    expect(hasValidBearerSecret(`Bearer ${secret}`, secret)).toBe(true);
    expect(hasValidBearerSecret("Bearer wrong", secret)).toBe(false);
    expect(hasValidBearerSecret(null, secret)).toBe(false);
    expect(hasValidBearerSecret(secret, secret)).toBe(false);
  });
});

describe("notification failure sanitization", () => {
  it("keeps only application-owned failure codes", () => {
    expect(notificationFailureCode(new Error("LINE_IDENTITY_MISSING"))).toBe("LINE_IDENTITY_MISSING");
    expect(notificationFailureCode(new Error("INVALID_NOTIFICATION_PAYLOAD"))).toBe("INVALID_NOTIFICATION_PAYLOAD");
  });

  it("does not persist provider errors or arbitrary values", () => {
    expect(notificationFailureCode(new Error("token=secret participant@example.jp"))).toBe("LINE_SEND_FAILED");
    expect(notificationFailureCode({ accessToken: "secret" })).toBe("LINE_SEND_FAILED");
  });
});
