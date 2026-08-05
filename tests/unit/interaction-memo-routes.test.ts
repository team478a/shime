import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/participant-auth", () => ({
  requireParticipantForEvent: vi.fn(),
}));

vi.mock("../../apps/web/src/server/interaction-memo-use-cases", () => ({
  getInteractionMemoWorkspace: { execute: vi.fn() },
  saveInteractionMemo: { execute: vi.fn() },
}));

const { requireParticipantForEvent } = await import("../../apps/web/src/server/participant-auth");
const useCases = await import("../../apps/web/src/server/interaction-memo-use-cases");
const { GET } = await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/route");
const { PUT } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/[slotId]/[targetParticipantId]/route");

const eventId = "10000000-0000-4000-8000-000000000001";
const slotId = "10000000-0000-4000-8000-000000000002";
const targetParticipantId = "10000000-0000-4000-8000-000000000003";
const participantAuth = {
  session: { userId: "user-1", tenantId: "tenant-1" },
  participant: { id: "participant-1", eventId },
};

function eventContext() {
  return { params: Promise.resolve({ eventId }) };
}

function noteContext() {
  return { params: Promise.resolve({ eventId, slotId, targetParticipantId }) };
}

beforeEach(() => {
  vi.mocked(requireParticipantForEvent)
    .mockReset()
    .mockResolvedValue(participantAuth as never);
  vi.mocked(useCases.getInteractionMemoWorkspace.execute).mockReset();
  vi.mocked(useCases.saveInteractionMemo.execute).mockReset();
});

describe("participant interaction memo API contract", () => {
  it("returns only the workspace scoped to the authenticated participant", async () => {
    vi.mocked(useCases.getInteractionMemoWorkspace.execute).mockResolvedValue({
      ok: true,
      data: { enabled: false, options: [], targets: [] },
    });

    const response = await GET(
      new Request(`https://example.test/api/liff/events/${eventId}/interaction-memo`),
      eventContext(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(useCases.getInteractionMemoWorkspace.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      eventId,
      serviceType: "marriage",
      participantId: "participant-1",
    });
    await expect(response.json()).resolves.toEqual({ data: { enabled: false, options: [], targets: [] } });
  });

  it("binds note ownership to the session and never accepts an actor id from the body", async () => {
    vi.mocked(useCases.saveInteractionMemo.execute).mockResolvedValue({
      ok: true,
      data: {
        id: "note-1",
        interactionSlotId: slotId,
        targetParticipantId,
        feelingCode: "comfortable",
        favorite: true,
        revision: 1,
        savedAt: new Date("2026-08-08T06:00:00.000Z"),
      },
    });
    const response = await PUT(
      new Request(`https://example.test/api/liff/events/${eventId}/interaction-memo/${slotId}/${targetParticipantId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actorParticipantId: "attacker-controlled",
          feelingCode: "comfortable",
          favorite: true,
          expectedRevision: 0,
        }),
      }),
      noteContext(),
    );

    expect(response.status).toBe(200);
    expect(useCases.saveInteractionMemo.execute).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: "participant-1", actorUserId: "user-1" }),
      {
        interactionSlotId: slotId,
        targetParticipantId,
        feelingCode: "comfortable",
        favorite: true,
        expectedRevision: 0,
      },
    );
  });

  it("returns a request id for revision conflicts without exposing private note values", async () => {
    vi.mocked(useCases.saveInteractionMemo.execute).mockResolvedValue({
      ok: false,
      code: "REVISION_CONFLICT",
      status: 409,
    });
    const response = await PUT(
      new Request(`https://example.test/api/liff/events/${eventId}/interaction-memo/${slotId}/${targetParticipantId}`, {
        method: "PUT",
        body: JSON.stringify({ feelingCode: "comfortable", favorite: false, expectedRevision: 1 }),
      }),
      noteContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: "REVISION_CONFLICT",
      message: expect.any(String),
      request_id: expect.any(String),
    });
    expect(body).not.toHaveProperty("note");
  });
});
