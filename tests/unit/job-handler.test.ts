import { describe, expect, it, vi } from "vitest";
import { BusinessRuleError } from "../../apps/web/src/server/api/errors";
import { createJobHandler } from "../../apps/web/src/server/api/job-handler";

describe("jobHandler contract", () => {
  it("preserves the health monitor unauthorized response", async () => {
    const handler = createJobHandler({
      loadSecret: () => undefined,
      validateBearer: () => false,
      createRequestId: () => "request-1",
    })({ includeRequestIdInErrors: false }, async () => Response.json({ ok: true }));

    const response = await handler(new Request("https://example.test/api/jobs/health-monitor"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
  });

  it("passes the request and request ID to an authenticated job", async () => {
    const handler = createJobHandler({
      loadSecret: () => "expected-secret",
      validateBearer: (authorization, expectedSecret) =>
        authorization === "Bearer expected-secret" && expectedSecret === "expected-secret",
      createRequestId: () => "request-2",
    })({}, ({ requestId }, request: Request) => Response.json({ method: request.method, requestId }));

    const response = await handler(
      new Request("https://example.test/api/jobs/health-monitor", {
        method: "POST",
        headers: { authorization: "Bearer expected-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ method: "POST", requestId: "request-2" });
  });

  it("maps known job errors without changing the selected response contract", async () => {
    const handler = createJobHandler({
      loadSecret: () => "expected-secret",
      validateBearer: () => true,
      createRequestId: () => "request-3",
    })({ includeRequestIdInErrors: false }, () => {
      throw new BusinessRuleError("JOB_DISABLED");
    });

    const response = await handler(new Request("https://example.test/api/jobs/health-monitor"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "JOB_DISABLED" });
  });

  it("supports notification job rejection logging, headers and incoming request IDs", async () => {
    const onUnauthorized = vi.fn();
    const handler = createJobHandler({
      loadSecret: () => "x".repeat(32),
      validateBearer: () => false,
      createRequestId: (request) => request.headers.get("x-request-id") ?? "generated",
    })(
      {
        minimumSecretLength: 32,
        onUnauthorized,
        unauthorizedHeaders: (requestId) => ({ "Cache-Control": "no-store", "x-request-id": requestId }),
      },
      async () => Response.json({ ok: true }),
    );

    const response = await handler(
      new Request("https://example.test/api/jobs/notifications", {
        headers: { "x-request-id": "incoming-request" },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("incoming-request");
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED", request_id: "incoming-request" });
    expect(onUnauthorized).toHaveBeenCalledWith({ requestId: "incoming-request" }, expect.any(Request));
  });

  it("rejects an invalid notification job secret configuration before authentication", async () => {
    const handler = createJobHandler({
      loadSecret: () => "too-short",
      validateBearer: () => true,
      createRequestId: () => "request-4",
    })({ minimumSecretLength: 32 }, async () => Response.json({ ok: true }));

    await expect(handler(new Request("https://example.test/api/jobs/notifications"))).rejects.toThrow(
      "INVALID_JOB_SECRET_CONFIGURATION",
    );
  });
});
