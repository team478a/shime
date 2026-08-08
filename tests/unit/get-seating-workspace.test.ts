import { describe, expect, it, vi } from "vitest";

import { GetSeatingWorkspace, type SeatAssignment, type SeatingRepository, type SeatingRun } from "@shime/seating";

const scope = { tenantId: "tenant-1", eventId: "event-1" };
const now = new Date("2026-07-24T00:00:00.000Z");

function run(id: string): SeatingRun {
  return {
    id,
    ...scope,
    algorithmVersion: "deterministic-v1",
    configSnapshot: { weights: {} },
    targetSnapshot: { participantIds: [] },
    status: "draft",
    scoreSummary: { pairCount: 0 },
    createdBy: "user-1",
    publishedBy: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function assignment(id: string, seatingRunId: string): SeatAssignment {
  return {
    id,
    ...scope,
    seatingRunId,
    participantId: `participant-${id}`,
    seatId: null,
    score: null,
    explanation: { mode: "fixed_text" },
    locked: false,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function repository(overrides: Partial<SeatingRepository> = {}): SeatingRepository {
  return {
    listRuns: async () => [],
    listAssignments: async () => [],
    listParticipants: async () => [],
    listSeats: async () => [],
    getPublishedParticipantSeat: async () => null,
    ...overrides,
  };
}

describe("GetSeatingWorkspace", () => {
  it("returns the empty seating workspace without querying assignments", async () => {
    const listAssignments = vi.fn();
    const useCase = new GetSeatingWorkspace(repository({ listAssignments }));

    await expect(useCase.execute(scope)).resolves.toEqual({
      runs: [],
      participants: [],
      seats: [],
    });
    expect(listAssignments).not.toHaveBeenCalled();
  });

  it("groups assignments into each run within the requested scope", async () => {
    const firstRun = run("run-1");
    const secondRun = run("run-2");
    const firstAssignment = assignment("1", firstRun.id);
    const secondAssignment = assignment("2", secondRun.id);
    const listAssignments = vi.fn(async () => [secondAssignment, firstAssignment]);
    const participants = [
      {
        id: "participant-1",
        participantNumber: "A01",
        fullName: "Test Participant",
        category: "group_a",
        checkinStatus: "checked_in" as const,
      },
    ];
    const seats = [
      {
        id: "seat-1",
        seatCode: "T01-1",
        tableCode: "T01",
        enabled: true,
      },
    ];
    const useCase = new GetSeatingWorkspace(
      repository({
        listRuns: async () => [firstRun, secondRun],
        listAssignments,
        listParticipants: async () => participants,
        listSeats: async () => seats,
      }),
    );

    await expect(useCase.execute(scope)).resolves.toEqual({
      runs: [
        { ...firstRun, assignments: [firstAssignment] },
        { ...secondRun, assignments: [secondAssignment] },
      ],
      participants,
      seats,
    });
    expect(listAssignments).toHaveBeenCalledWith(scope, [firstRun.id, secondRun.id]);
  });
});
