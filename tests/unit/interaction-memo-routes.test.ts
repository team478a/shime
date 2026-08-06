import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/participant-auth", () => ({
  requireParticipantForEvent: vi.fn(),
}));

vi.mock("../../apps/web/src/server/interaction-memo-use-cases", () => ({
  cancelSelfReportedInteractionSlot: { execute: vi.fn() },
  createSelfReportedInteractionSlot: { execute: vi.fn() },
  getInteractionMemoWorkspace: { execute: vi.fn() },
  getInteractionPublicProfile: { execute: vi.fn() },
  saveInteractionMemo: { execute: vi.fn() },
  searchSelfReportedInteractionTargets: { execute: vi.fn() },
}));

const { requireParticipantForEvent } = await import("../../apps/web/src/server/participant-auth");
const useCases = await import("../../apps/web/src/server/interaction-memo-use-cases");
const { GET } = await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/route");
const { GET: GET_PROFILE } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/interactions/[targetParticipantId]/profile/route");
const { PUT } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/[slotId]/[targetParticipantId]/route");
const { GET: GET_CANDIDATES } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/target-candidates/route");
const { POST: POST_SLOT } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/slots/route");
const { DELETE: DELETE_SLOT } =
  await import("../../apps/web/src/app/api/liff/events/[eventId]/interaction-memo/slots/[slotId]/[targetParticipantId]/route");

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

function profileContext() {
  return { params: Promise.resolve({ eventId, targetParticipantId }) };
}

beforeEach(() => {
  vi.mocked(requireParticipantForEvent)
    .mockReset()
    .mockResolvedValue(participantAuth as never);
  vi.mocked(useCases.getInteractionMemoWorkspace.execute).mockReset();
  vi.mocked(useCases.getInteractionPublicProfile.execute).mockReset();
  vi.mocked(useCases.saveInteractionMemo.execute).mockReset();
  vi.mocked(useCases.searchSelfReportedInteractionTargets.execute).mockReset();
  vi.mocked(useCases.createSelfReportedInteractionSlot.execute).mockReset();
  vi.mocked(useCases.cancelSelfReportedInteractionSlot.execute).mockReset();
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

  it("rejects an actor id from the body and always binds ownership to the session", async () => {
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

    expect(response.status).toBe(400);
    expect(useCases.saveInteractionMemo.execute).not.toHaveBeenCalled();
  });

  it("saves the private memo and reversible interest flag under the authenticated actor", async () => {
    vi.mocked(useCases.saveInteractionMemo.execute).mockResolvedValue({
      ok: true,
      data: {
        id: "note-1",
        interactionSlotId: slotId,
        targetParticipantId,
        feelingCode: "comfortable",
        favorite: true,
        privateNoteText: "笑顔が印象的",
        wantsToTalkMore: true,
        revision: 1,
        savedAt: new Date("2026-08-08T06:00:00.000Z"),
      },
    });
    const response = await PUT(
      new Request(`https://example.test/api/liff/events/${eventId}/interaction-memo/${slotId}/${targetParticipantId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feelingCode: "comfortable",
          favorite: true,
          privateNoteText: "笑顔が印象的",
          wantsToTalkMore: true,
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
        privateNoteText: "笑顔が印象的",
        wantsToTalkMore: true,
        expectedRevision: 0,
      },
    );
  });

  it("returns only the server-built allowlisted public profile with no-store", async () => {
    vi.mocked(useCases.getInteractionPublicProfile.execute).mockResolvedValue({
      ok: true,
      data: {
        participantNumber: "B03",
        fields: [
          { key: "nickname", label: "ニックネーム", value: "はな" },
          { key: "age_or_band", label: "年代", value: "30代" },
        ],
      },
    });

    const response = await GET_PROFILE(
      new Request(`https://example.test/api/liff/events/${eventId}/interactions/${targetParticipantId}/profile`),
      profileContext(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        participantNumber: "B03",
        fields: [
          { key: "nickname", label: "ニックネーム", value: "はな" },
          { key: "age_or_band", label: "年代", value: "30代" },
        ],
      },
    });
    expect(useCases.getInteractionPublicProfile.execute).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: "participant-1", eventId, tenantId: "tenant-1" }),
      targetParticipantId,
    );
  });

  it("rejects private memo text over 120 characters or 3 lines before the use case", async () => {
    for (const privateNoteText of ["x".repeat(121), "1\n2\n3\n4"]) {
      const response = await PUT(
        new Request(
          `https://example.test/api/liff/events/${eventId}/interaction-memo/${slotId}/${targetParticipantId}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              feelingCode: "comfortable",
              favorite: false,
              privateNoteText,
              wantsToTalkMore: true,
              expectedRevision: 0,
            }),
          },
        ),
        noteContext(),
      );
      expect(response.status).toBe(400);
    }
    expect(useCases.saveInteractionMemo.execute).not.toHaveBeenCalled();
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

  it("returns only opaque id and participant number for self-reported candidates", async () => {
    vi.mocked(useCases.searchSelfReportedInteractionTargets.execute).mockResolvedValue({
      ok: true,
      data: [{ targetParticipantId, participantNumber: "B03" }],
    });
    const response = await GET_CANDIDATES(
      new Request(`https://example.test/api/liff/events/${eventId}/interaction-memo/target-candidates?q=B`),
      eventContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ targetParticipantId, participantNumber: "B03" }],
    });
    expect(useCases.searchSelfReportedInteractionTargets.execute).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: "participant-1", eventId }),
      "B",
    );
  });

  it("creates a self-reported slot with actor ownership bound to the session", async () => {
    vi.mocked(useCases.createSelfReportedInteractionSlot.execute).mockResolvedValue({
      ok: true,
      data: { interactionSlotId: slotId, targetParticipantId, participantNumber: "B03", roundNo: null },
    });
    const response = await POST_SLOT(
      new Request(`https://example.test/api/liff/events/${eventId}/interaction-memo/slots`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetParticipantId }),
      }),
      eventContext(),
    );

    expect(response.status).toBe(200);
    expect(useCases.createSelfReportedInteractionSlot.execute).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: "participant-1", actorUserId: "user-1", eventId }),
      targetParticipantId,
    );
  });

  it("does not allow cancellation once a private note exists", async () => {
    vi.mocked(useCases.cancelSelfReportedInteractionSlot.execute).mockResolvedValue({
      ok: false,
      code: "INTERACTION_TARGET_HAS_NOTE",
      status: 409,
    });
    const response = await DELETE_SLOT(
      new Request(
        `https://example.test/api/liff/events/${eventId}/interaction-memo/slots/${slotId}/${targetParticipantId}`,
        { method: "DELETE" },
      ),
      noteContext(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "INTERACTION_TARGET_HAS_NOTE",
      message: "メモ入力後の会話相手は取り消せません。",
      request_id: expect.any(String),
    });
  });
});
