import { describe, expect, it } from "vitest";

import { BusinessRuleError } from "../../apps/web/src/server/api/errors";
import { createPublicEventHandler, createPublicHandler } from "../../apps/web/src/server/api/public-handler";

describe("publicHandler contract", () => {
  it("passes the request and request ID to a public operation", async () => {
    const handler = createPublicHandler({
      createRequestId: () => "request-1",
    })({}, ({ requestId }, request: Request) => Response.json({ method: request.method, requestId }));

    const response = await handler(new Request("https://example.test/api/public/events/event-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      method: "GET",
      requestId: "request-1",
    });
  });

  it("maps known errors without changing a legacy public response", async () => {
    const handler = createPublicHandler({
      createRequestId: () => "request-2",
    })({ includeRequestIdInErrors: false }, () => {
      throw new BusinessRuleError("EVENT_CLOSED");
    });

    const response = await handler(new Request("https://example.test/api/public/events/event-1"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "EVENT_CLOSED" });
  });

  it("resolves and passes the event scope to a public event operation", async () => {
    const handler = createPublicEventHandler({
      createRequestId: () => "request-3",
    })(
      {},
      async (_request, context: { params: Promise<{ eventId: string }> }) => (await context.params).eventId,
      ({ eventId, requestId }) => Response.json({ eventId, requestId }),
    );

    const response = await handler(new Request("https://example.test/api/public/events/event-1"), {
      params: Promise.resolve({ eventId: "event-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      eventId: "event-1",
      requestId: "request-3",
    });
  });
});
