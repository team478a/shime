import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  canReissueLinkToken,
  createOpaqueToken,
  FakeLineProvider,
  HttpLineProvider,
  LineProviderError,
  LINK_TOKEN_TTL_MS,
  verifyLastFour,
  verifyWebhookSignature,
} from "@shime/core";

describe("LINE boundary", () => {
  it("verifies ID tokens only through the provider", async () => {
    const provider = new FakeLineProvider(new Map([["raw-token", "U123"]]));
    await expect(provider.verifyIdToken("raw-token")).resolves.toEqual({ lineUserId: "U123" });
    await expect(provider.verifyIdToken("forged")).rejects.toBeInstanceOf(LineProviderError);
  });
  it("verifies the raw ID token against LINE with the configured channel ID", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sub: "U123", exp: Math.floor(Date.now() / 1000) + 60 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new HttpLineProvider({ channelId: "line-login-channel", channelAccessToken: "unused" });

    await expect(provider.verifyIdToken("raw-id-token")).resolves.toEqual({ lineUserId: "U123" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.line.me/oauth2/v2.1/verify");
    expect(init).toMatchObject({ method: "POST" });
    expect(String(init?.body)).toBe("id_token=raw-id-token&client_id=line-login-channel");
    fetchMock.mockRestore();
  });
  it("rejects an expired LINE ID token after provider verification", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sub: "U123", exp: Math.floor(Date.now() / 1000) - 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new HttpLineProvider({ channelId: "line-login-channel", channelAccessToken: "unused" });

    await expect(provider.verifyIdToken("expired-id-token")).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    fetchMock.mockRestore();
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
