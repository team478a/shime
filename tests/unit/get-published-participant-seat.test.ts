import { describe, expect, it, vi } from "vitest";

import { GetPublishedParticipantSeat, type PublishedParticipantSeat, type SeatingRepository } from "@shime/seating";

const scope = { tenantId: "tenant-1", eventId: "event-1" };

function repository(getPublishedParticipantSeat: SeatingRepository["getPublishedParticipantSeat"]): SeatingRepository {
  return {
    listRuns: async () => [],
    listAssignments: async () => [],
    listParticipants: async () => [],
    listSeats: async () => [],
    getPublishedParticipantSeat,
  };
}

describe("GetPublishedParticipantSeat", () => {
  it("requests only the authenticated participant within the tenant and event scope", async () => {
    const seat: PublishedParticipantSeat = {
      tableCode: "T01",
      seatCode: "T01-1",
      explanation: { mode: "fixed_text" },
      publishedAt: new Date("2026-07-31T04:00:00.000Z"),
    };
    const getPublishedParticipantSeat = vi.fn(async () => seat);
    const useCase = new GetPublishedParticipantSeat(repository(getPublishedParticipantSeat));

    await expect(useCase.execute(scope, "participant-1")).resolves.toEqual(seat);
    expect(getPublishedParticipantSeat).toHaveBeenCalledWith(scope, "participant-1");
    expect(getPublishedParticipantSeat).not.toHaveBeenCalledWith(scope, "participant-2");
  });

  it("does not expose a seat before the participant has a published assignment", async () => {
    const useCase = new GetPublishedParticipantSeat(repository(async () => null));

    await expect(useCase.execute(scope, "participant-1")).resolves.toBeNull();
  });
});
