import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/participant-auth", () => ({
  requireParticipantForEvent: vi.fn(),
}));

vi.mock("../../apps/web/src/server/match-chat-use-cases", () => ({
  acceptMatchChatConsent: { execute: vi.fn() },
  blockMatchChatRoom: { execute: vi.fn() },
  ensureMatchChatRoom: { execute: vi.fn() },
  listMatchChatMessages: { execute: vi.fn() },
  reportMatchChatParticipant: { execute: vi.fn() },
  sendMatchChatMessage: { execute: vi.fn() },
}));

const { requireParticipantForEvent } = await import("../../apps/web/src/server/participant-auth");
const useCases = await import("../../apps/web/src/server/match-chat-use-cases");
const { POST: CREATE_ROOM } = await import("../../apps/web/src/app/api/liff/events/[eventId]/match-chat/rooms/route");
const { GET: LIST_MESSAGES, POST: SEND_MESSAGE } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/match-chat/rooms/[roomId]/messages/route");

const eventId = "10000000-0000-4000-8000-000000000001";
const roomId = "10000000-0000-4000-8000-000000000002";
const matchCandidateId = "10000000-0000-4000-8000-000000000003";
const clientMessageId = "10000000-0000-4000-8000-000000000004";
const auth = {
  session: { userId: "user-a", tenantId: "tenant-a" },
  participant: { id: "participant-a", eventId },
};

function eventContext() {
  return { params: Promise.resolve({ eventId }) };
}

function roomContext() {
  return { params: Promise.resolve({ eventId, roomId }) };
}

beforeEach(() => {
  vi.mocked(requireParticipantForEvent)
    .mockReset()
    .mockResolvedValue(auth as never);
  vi.mocked(useCases.acceptMatchChatConsent.execute).mockReset();
  vi.mocked(useCases.blockMatchChatRoom.execute).mockReset();
  vi.mocked(useCases.ensureMatchChatRoom.execute).mockReset();
  vi.mocked(useCases.listMatchChatMessages.execute).mockReset();
  vi.mocked(useCases.reportMatchChatParticipant.execute).mockReset();
  vi.mocked(useCases.sendMatchChatMessage.execute).mockReset();
});

describe("participant match chat API contract", () => {
  it("binds room creation to the participant session and rejects injected actor fields", async () => {
    const rejected = await CREATE_ROOM(
      new Request(`https://example.test/api/liff/events/${eventId}/match-chat/rooms`, {
        method: "POST",
        body: JSON.stringify({ matchCandidateId, participantId: "attacker-controlled" }),
      }),
      eventContext(),
    );
    expect(rejected.status).toBe(400);
    expect(useCases.ensureMatchChatRoom.execute).not.toHaveBeenCalled();

    vi.mocked(useCases.ensureMatchChatRoom.execute).mockResolvedValue({
      ok: true,
      data: {
        termsVersion: "chat-v1",
        termsBody: "相手を尊重し、安全に利用してください。",
        maxMessageLength: 500,
        participantConsented: false,
        room: {
          id: roomId,
          matchCandidateId,
          participantAId: "participant-a",
          participantBId: "participant-b",
          status: "pending_consent",
          opensAt: null,
          closesAt: new Date("2026-08-11T06:00:00.000Z"),
        },
      },
    });
    const accepted = await CREATE_ROOM(
      new Request(`https://example.test/api/liff/events/${eventId}/match-chat/rooms`, {
        method: "POST",
        body: JSON.stringify({ matchCandidateId }),
      }),
      eventContext(),
    );
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("cache-control")).toBe("no-store");
    expect(useCases.ensureMatchChatRoom.execute).toHaveBeenCalledWith(
      { tenantId: "tenant-a", eventId, serviceType: "marriage", participantId: "participant-a" },
      matchCandidateId,
    );
    const body = await accepted.json();
    expect(body.data).not.toHaveProperty("participantAId");
    expect(body.data).not.toHaveProperty("participantBId");
    expect(body.data).toMatchObject({
      termsVersion: "chat-v1",
      termsBody: "相手を尊重し、安全に利用してください。",
      maxMessageLength: 500,
      participantConsented: false,
    });
  });

  it("sends an allowlisted message payload and never accepts a sender id from the client", async () => {
    const rejected = await SEND_MESSAGE(
      new Request(`https://example.test/api/liff/events/${eventId}/match-chat/rooms/${roomId}/messages`, {
        method: "POST",
        body: JSON.stringify({ clientMessageId, body: "hello", senderParticipantId: "attacker-controlled" }),
      }),
      roomContext(),
    );
    expect(rejected.status).toBe(400);

    vi.mocked(useCases.sendMatchChatMessage.execute).mockResolvedValue({
      ok: true,
      data: { id: "message-1", sender: "self", body: "hello", sentAt: "2026-08-08T06:00:00.000Z" },
    });
    const response = await SEND_MESSAGE(
      new Request(`https://example.test/api/liff/events/${eventId}/match-chat/rooms/${roomId}/messages`, {
        method: "POST",
        body: JSON.stringify({ clientMessageId, body: "hello" }),
      }),
      roomContext(),
    );
    expect(response.status).toBe(200);
    expect(useCases.sendMatchChatMessage.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a", eventId, participantId: "participant-a" }),
      roomId,
      { clientMessageId, body: "hello" },
    );
  });

  it("returns a safe error with a request id when access is blocked", async () => {
    vi.mocked(useCases.listMatchChatMessages.execute).mockResolvedValue({
      ok: false,
      code: "MATCH_CHAT_BLOCKED",
      status: 403,
    });
    const response = await LIST_MESSAGES(
      new Request(`https://example.test/api/liff/events/${eventId}/match-chat/rooms/${roomId}/messages`),
      roomContext(),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "MATCH_CHAT_BLOCKED",
      message: expect.any(String),
      request_id: expect.any(String),
    });
  });

  it("rejects a participant session that is not bound to the requested event", async () => {
    vi.mocked(requireParticipantForEvent).mockRejectedValueOnce(new Error("Not found"));
    const response = await LIST_MESSAGES(
      new Request(`https://example.test/api/liff/events/${eventId}/match-chat/rooms/${roomId}/messages`),
      roomContext(),
    );
    expect(response.status).toBe(401);
    expect(useCases.listMatchChatMessages.execute).not.toHaveBeenCalled();
  });
});
