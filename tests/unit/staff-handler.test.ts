import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createStaffEventHandler,
  createStaffHandler,
  parseJsonBody,
} from "../../apps/web/src/server/api/staff-handler";

const systemAdminSession = {
  userId: "user-1",
  tenantId: "tenant-1",
  displayName: "System Admin",
  role: "system_admin" as const,
  eventId: null,
};

describe("staffHandler contract", () => {
  it("preserves the staff list authentication error body", async () => {
    const handler = createStaffHandler({
      loadSession: async () => null,
      createRequestId: () => "request-1",
    })({ permission: "staff:manage", includeRequestIdInErrors: false }, async () => Response.json({ data: [] }));

    const response = await handler();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
  });

  it("adds the request ID to write authentication and permission errors", async () => {
    const unauthorized = createStaffHandler({
      loadSession: async () => null,
      createRequestId: () => "request-2",
    })({ permission: "staff:manage" }, async () => Response.json({ ok: true }));
    const forbidden = createStaffHandler({
      loadSession: async () => ({ ...systemAdminSession, role: "manager" }),
      createRequestId: () => "request-3",
    })({ permission: "staff:manage" }, async () => Response.json({ ok: true }));

    const unauthorizedResponse = await unauthorized();
    const forbiddenResponse = await forbidden();

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({ code: "UNAUTHORIZED", request_id: "request-2" });
    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toEqual({ code: "FORBIDDEN", request_id: "request-3" });
  });

  it("provides the authenticated tenant context to the route action", async () => {
    const handler = createStaffHandler({
      loadSession: async () => systemAdminSession,
      createRequestId: () => "request-4",
    })({ permission: "staff:manage" }, ({ requestId, session }) =>
      Response.json({ requestId, tenantId: session.tenantId }),
    );

    const response = await handler();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ requestId: "request-4", tenantId: "tenant-1" });
  });

  it("keeps the existing validation error contract", async () => {
    const handler = createStaffHandler({
      loadSession: async () => systemAdminSession,
      createRequestId: () => "request-5",
    })({ permission: "staff:manage" }, async (_context, request: Request) => {
      await parseJsonBody(request, z.object({ displayName: z.string().min(1) }));
      return Response.json({ ok: true });
    });

    const response = await handler(
      new Request("https://example.test/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({ displayName: "" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_INPUT", request_id: "request-5" });
  });
});

describe("staffEventHandler contract", () => {
  it("allows a tenant-wide staff role to access the requested event", async () => {
    const handler = createStaffEventHandler({
      loadSession: async () => ({ ...systemAdminSession, role: "reception" }),
      createRequestId: () => "request-6",
    })(
      { permission: "checkin:write", includeRequestIdInErrors: false },
      async (routeContext: { params: Promise<{ eventId: string }> }) => (await routeContext.params).eventId,
      ({ eventId }) => Response.json({ eventId }),
    );

    const response = await handler({ params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ eventId: "event-1" });
  });

  it("rejects an event-scoped staff role accessing another event", async () => {
    const handler = createStaffEventHandler({
      loadSession: async () => ({ ...systemAdminSession, role: "reception", eventId: "event-1" }),
      createRequestId: () => "request-7",
    })(
      { permission: "checkin:write", includeRequestIdInErrors: false },
      async (routeContext: { params: Promise<{ eventId: string }> }) => (await routeContext.params).eventId,
      () => Response.json({ ok: true }),
    );

    const response = await handler({ params: Promise.resolve({ eventId: "event-2" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "FORBIDDEN" });
  });

  it("preserves check-in validation errors without a request ID", async () => {
    const handler = createStaffEventHandler({
      loadSession: async () => ({ ...systemAdminSession, role: "reception" }),
      createRequestId: () => "request-8",
    })(
      { permission: "checkin:write", includeRequestIdInErrors: false },
      async (_request: Request, routeContext: { params: Promise<{ eventId: string }> }) =>
        (await routeContext.params).eventId,
      async (_context, request: Request) => {
        await parseJsonBody(request, z.object({ reason: z.string().min(1) }), "REASON_REQUIRED");
        return Response.json({ ok: true });
      },
    );

    const response = await handler(
      new Request("https://example.test/api/admin/events/event-1/checkins/participant-1/cancel", {
        method: "POST",
        body: JSON.stringify({ reason: "" }),
      }),
      { params: Promise.resolve({ eventId: "event-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "REASON_REQUIRED" });
  });
});
