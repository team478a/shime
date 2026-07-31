import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/participant-auth", () => ({
  requireParticipantForEvent: vi.fn(),
}));

vi.mock("../../apps/web/src/server/seating-use-cases", () => ({
  getPublishedParticipantSeat: { execute: vi.fn() },
}));

const { requireParticipantForEvent } = await import("../../apps/web/src/server/participant-auth");
const { getPublishedParticipantSeat } = await import("../../apps/web/src/server/seating-use-cases");
const { GET } = await import("../../apps/web/src/app/api/liff/events/[eventId]/seat/route");

function context(eventId = "event-1") {
  return { params: Promise.resolve({ eventId }) };
}

beforeEach(() => {
  vi.mocked(requireParticipantForEvent)
    .mockReset()
    .mockResolvedValue({
      session: { userId: "user-1", tenantId: "tenant-1" },
      participant: { id: "participant-1", eventId: "event-1" },
    } as never);
  vi.mocked(getPublishedParticipantSeat.execute).mockReset();
});

describe("participant seat API contract", () => {
  it("loads the seat only for the participant authenticated in the requested event", async () => {
    vi.mocked(getPublishedParticipantSeat.execute).mockResolvedValue({
      tableCode: "T01",
      seatCode: "T01-1",
      explanation: { mode: "fixed_text" },
      publishedAt: new Date("2026-07-31T04:00:00.000Z"),
    });

    const response = await GET(new Request("https://example.test/api/liff/events/event-1/seat"), context());

    expect(response.status).toBe(200);
    expect(getPublishedParticipantSeat.execute).toHaveBeenCalledWith(
      { tenantId: "tenant-1", eventId: "event-1" },
      "participant-1",
    );
    expect(getPublishedParticipantSeat.execute).not.toHaveBeenCalledWith(expect.anything(), "participant-2");
    await expect(response.json()).resolves.toMatchObject({
      data: { tableCode: "T01", seatCode: "T01-1" },
    });
  });

  it("returns no other participant seat when the authenticated participant has no published assignment", async () => {
    vi.mocked(requireParticipantForEvent).mockResolvedValue({
      session: { userId: "user-2", tenantId: "tenant-1" },
      participant: { id: "participant-2", eventId: "event-1" },
    } as never);
    vi.mocked(getPublishedParticipantSeat.execute).mockResolvedValue(null);

    const response = await GET(new Request("https://example.test/api/liff/events/event-1/seat"), context());

    expect(getPublishedParticipantSeat.execute).toHaveBeenCalledWith(
      { tenantId: "tenant-1", eventId: "event-1" },
      "participant-2",
    );
    await expect(response.json()).resolves.toEqual({ data: null });
  });

  it("rejects a caller without a linked participant session", async () => {
    vi.mocked(requireParticipantForEvent).mockRejectedValue(new Error("Not linked"));

    const response = await GET(new Request("https://example.test/api/liff/events/event-1/seat"), context());

    expect(response.status).toBe(401);
    expect(getPublishedParticipantSeat.execute).not.toHaveBeenCalled();
  });
});
