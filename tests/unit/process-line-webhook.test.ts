import { describe, expect, it, vi } from "vitest";
import type {
  LineUserIdHasher,
  LineWebhookRepository,
  LineWebhookSecretProvider,
  WebhookPepperProvider,
} from "@shime/integrations";
import { ProcessLineWebhook } from "@shime/integrations";

const processedAt = new Date("2026-07-24T05:00:00.000Z");
const validBody = JSON.stringify({
  events: [
    {
      webhookEventId: "webhook-1",
      type: "follow",
      timestamp: 1_753_332_000_000,
      source: { userId: "raw-line-user-id" },
    },
    {
      webhookEventId: "webhook-2",
      type: "unfollow",
    },
  ],
});

function repository(overrides: Partial<LineWebhookRepository> = {}): LineWebhookRepository {
  return {
    findTenantIdByCode: async () => "tenant-1",
    storeIfNew: async () => undefined,
    ...overrides,
  };
}

const secretProvider: LineWebhookSecretProvider = {
  getSecret: async () => "channel-secret",
};
const pepperProvider: WebhookPepperProvider = {
  getPepper: () => "p".repeat(32),
};
const hasher: LineUserIdHasher = {
  hash: (lineUserId, pepper) => `hash:${lineUserId}:${pepper.length}`,
};

describe("ProcessLineWebhook", () => {
  it("returns tenant not found before loading LINE configuration", async () => {
    const getSecret = vi.fn(async () => "channel-secret");
    const useCase = new ProcessLineWebhook(
      repository({ findTenantIdByCode: async () => null }),
      { getSecret },
      pepperProvider,
      () => true,
      hasher,
    );

    await expect(
      useCase.execute({ tenantCode: "missing", rawBody: validBody, signature: "signature" }),
    ).resolves.toEqual({
      ok: false,
      code: "TENANT_NOT_FOUND",
      status: 404,
    });
    expect(getSecret).not.toHaveBeenCalled();
  });

  it("maps LINE configuration failures without parsing or storing the event", async () => {
    const storeIfNew = vi.fn(async () => undefined);
    const useCase = new ProcessLineWebhook(
      repository({ storeIfNew }),
      {
        getSecret: async () => {
          throw new Error("secret details");
        },
      },
      pepperProvider,
      () => true,
      hasher,
    );

    await expect(
      useCase.execute({ tenantCode: "tenant-a", rawBody: validBody, signature: "signature" }),
    ).resolves.toEqual({
      ok: false,
      code: "LINE_NOT_CONFIGURED",
      status: 503,
    });
    expect(storeIfNew).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before body and pepper processing", async () => {
    const getPepper = vi.fn(() => "p".repeat(32));
    const storeIfNew = vi.fn(async () => undefined);
    const useCase = new ProcessLineWebhook(
      repository({ storeIfNew }),
      secretProvider,
      { getPepper },
      () => false,
      hasher,
    );

    await expect(
      useCase.execute({ tenantCode: "tenant-a", rawBody: validBody, signature: "invalid" }),
    ).resolves.toEqual({
      ok: false,
      code: "INVALID_SIGNATURE",
      status: 401,
    });
    expect(getPepper).not.toHaveBeenCalled();
    expect(storeIfNew).not.toHaveBeenCalled();
  });

  it("rejects malformed and schema-invalid bodies before loading the pepper", async () => {
    const getPepper = vi.fn(() => "p".repeat(32));
    const useCase = new ProcessLineWebhook(repository(), secretProvider, { getPepper }, () => true, hasher);

    await expect(useCase.execute({ tenantCode: "tenant-a", rawBody: "{", signature: "signature" })).resolves.toEqual({
      ok: false,
      code: "INVALID_BODY",
      status: 400,
    });
    await expect(
      useCase.execute({ tenantCode: "tenant-a", rawBody: '{"events":[{}]}', signature: "signature" }),
    ).resolves.toEqual({
      ok: false,
      code: "INVALID_BODY",
      status: 400,
    });
    expect(getPepper).not.toHaveBeenCalled();
  });

  it("hashes LINE user IDs and delegates idempotent storage with tenant scope", async () => {
    const storeIfNew = vi.fn(async () => undefined);
    const hash = vi.fn(hasher.hash);
    const useCase = new ProcessLineWebhook(
      repository({ storeIfNew }),
      secretProvider,
      pepperProvider,
      (rawBody, signature, secret) => rawBody === validBody && signature === "signature" && secret === "channel-secret",
      { hash },
      () => processedAt,
    );

    await expect(
      useCase.execute({ tenantCode: "tenant-a", rawBody: validBody, signature: "signature" }),
    ).resolves.toEqual({ ok: true });
    expect(hash).toHaveBeenCalledWith("raw-line-user-id", "p".repeat(32));
    expect(storeIfNew).toHaveBeenCalledWith("tenant-1", [
      {
        webhookEventId: "webhook-1",
        eventType: "follow",
        lineUserIdHash: "hash:raw-line-user-id:32",
        occurredAt: new Date(1_753_332_000_000),
        processedAt,
      },
      {
        webhookEventId: "webhook-2",
        eventType: "unfollow",
        lineUserIdHash: null,
        occurredAt: null,
        processedAt,
      },
    ]);
  });
});
