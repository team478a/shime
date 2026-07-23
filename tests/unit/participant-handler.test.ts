import { describe, expect, it } from "vitest";
import { BusinessRuleError } from "../../apps/web/src/server/api/errors";
import { createParticipantHandler } from "../../apps/web/src/server/api/participant-handler";

const auth = {
  session: { userId: "user-1", tenantId: "tenant-1" },
  participant: {
    id: "participant-1",
    tenantId: "tenant-1",
    eventId: "event-1",
    applicationId: "application-1",
    userId: "user-1",
    participantNumber: "A01",
    category: "group_a",
    status: "confirmed" as const,
    dreamState: "not_started" as const,
    linkTokenHash: null,
    linkTokenExpiresAt: null,
    linkTokenUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe("participantHandler contract", () => {
  it("preserves the unauthorized response for a missing event participant", async () => {
    const handler = createParticipantHandler({
      loadParticipant: async () => null,
      createRequestId: () => "request-1",
    })(
      async (routeContext: { params: Promise<{ eventId: string }> }) => (await routeContext.params).eventId,
      () => Response.json({ ok: true }),
    );

    const response = await handler({ params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
  });

  it("provides tenant, event and participant context", async () => {
    const handler = createParticipantHandler({
      loadParticipant: async () => auth,
      createRequestId: () => "request-2",
    })(
      async (routeContext: { params: Promise<{ eventId: string }> }) => (await routeContext.params).eventId,
      ({ eventId, participant, requestId, session }) =>
        Response.json({
          eventId,
          participantId: participant.id,
          requestId,
          tenantId: session.tenantId,
        }),
    );

    const response = await handler({ params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      eventId: "event-1",
      participantId: "participant-1",
      requestId: "request-2",
      tenantId: "tenant-1",
    });
  });

  it("passes the request and route arguments through to update handlers", async () => {
    const handler = createParticipantHandler({
      loadParticipant: async () => auth,
      createRequestId: () => "request-update",
    })(
      async (_request: Request, routeContext: { params: Promise<{ eventId: string }> }) =>
        (await routeContext.params).eventId,
      async ({ participant }, request: Request) =>
        Response.json({
          method: request.method,
          participantId: participant.id,
          payload: await request.json(),
        }),
    );

    const request = new Request("https://example.test/api/liff/events/event-1/passport", {
      method: "POST",
      body: JSON.stringify({ issue: true }),
    });
    const response = await handler(request, { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      method: "POST",
      participantId: "participant-1",
      payload: { issue: true },
    });
  });

  it("preserves known participant API errors without adding a request ID", async () => {
    const handler = createParticipantHandler({
      loadParticipant: async () => auth,
      createRequestId: () => "request-3",
    })(
      async (routeContext: { params: Promise<{ eventId: string }> }) => (await routeContext.params).eventId,
      () => {
        throw new BusinessRuleError("NOT_ISSUED", 404);
      },
    );

    const response = await handler({ params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ code: "NOT_ISSUED" });
  });
});
