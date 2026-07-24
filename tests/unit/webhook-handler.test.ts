import { describe, expect, it } from "vitest";
import { BusinessRuleError } from "../../apps/web/src/server/api/errors";
import { createWebhookHandler } from "../../apps/web/src/server/api/webhook-handler";

describe("webhookHandler contract", () => {
  it("preserves the missing tenant response after reading the body", async () => {
    const handler = createWebhookHandler({
      createRequestId: () => "request-1",
    })(async () => Response.json({ ok: true }));

    const response = await handler(
      new Request("https://example.test/api/webhooks/line", {
        method: "POST",
        body: '{"events":[]}',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "TENANT_REQUIRED" });
  });

  it("provides the raw body, tenant and signature without exposing them in a response", async () => {
    const handler = createWebhookHandler({
      createRequestId: (request) => request.headers.get("x-request-id") ?? "generated",
    })(({ rawBody, requestId, signature, tenantCode }) => Response.json({ rawBody, requestId, signature, tenantCode }));

    const response = await handler(
      new Request("https://example.test/api/webhooks/line?tenant=tenant-a", {
        method: "POST",
        body: '{"events":[]}',
        headers: {
          "x-line-signature": "signature",
          "x-request-id": "incoming-request",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      rawBody: '{"events":[]}',
      requestId: "incoming-request",
      signature: "signature",
      tenantCode: "tenant-a",
    });
  });

  it("preserves known webhook errors without adding a request ID", async () => {
    const handler = createWebhookHandler({
      createRequestId: () => "request-3",
    })(() => {
      throw new BusinessRuleError("WEBHOOK_REJECTED", 409);
    });

    const response = await handler(
      new Request("https://example.test/api/webhooks/line?tenant=tenant-a", {
        method: "POST",
        body: '{"events":[]}',
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "WEBHOOK_REJECTED" });
  });
});
