import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canReissueLinkToken,
  createOpaqueToken,
  FakeLineProvider,
  LINK_TOKEN_TTL_MS,
  LineProviderError,
  verifyLastFour,
  verifyWebhookSignature,
} from "@shime/core";

describe("LINE boundary", () => {
  it("verifies ID tokens only through the provider", async () => {
    const provider = new FakeLineProvider(new Map([["raw-token", "U123"]]));
    await expect(provider.verifyIdToken("raw-token")).resolves.toEqual({ lineUserId: "U123" });
    await expect(provider.verifyIdToken("forged")).rejects.toBeInstanceOf(LineProviderError);
  });
  it("hashes opaque tokens", () => {
    const result = createOpaqueToken("pepper");
    expect(result.token).not.toBe(result.tokenHash);
    expect(result.tokenHash).toHaveLength(64);
  });
  it("reissues link tokens only before LINE linkage and keeps the 72-hour lifetime", () => {
    expect(canReissueLinkToken(null)).toBe(true);
    expect(canReissueLinkToken("linked-user")).toBe(false);
    expect(LINK_TOKEN_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });
  it("verifies webhook HMAC", () => {
    const body = '{"events":[]}';
    const signature = createHmac("sha256", "secret").update(body).digest("base64");
    expect(verifyWebhookSignature(body, signature, "secret")).toBe(true);
    expect(verifyWebhookSignature(body, "bad", "secret")).toBe(false);
  });
  it("uses phone last four only as an auxiliary check", () => {
    expect(verifyLastFour("09012345678", "5678")).toBe(true);
    expect(verifyLastFour("09012345678", "1234")).toBe(false);
  });
});
