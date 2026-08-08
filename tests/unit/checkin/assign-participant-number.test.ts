import { describe, expect, it, vi } from "vitest";

import { AssignParticipantNumber } from "@shime/checkin/assign-participant-number";
import type { CheckinRepository } from "@shime/checkin/checkin-repository";
import type { AssignParticipantNumberInput } from "@shime/checkin/checkin-types";

const input: AssignParticipantNumberInput = {
  tenantId: "tenant-1",
  eventId: "event-1",
  participantId: "participant-1",
  participantNumber: "ａ０１",
  actorUserId: "staff-1",
  requestId: "request-1",
  now: new Date("2026-08-08T03:00:00.000Z"),
};

function repository(outcome: Awaited<ReturnType<CheckinRepository["assignParticipantNumber"]>>): CheckinRepository {
  return {
    confirm: vi.fn(),
    assignParticipantNumber: vi.fn().mockResolvedValue(outcome),
  };
}

describe("AssignParticipantNumber", () => {
  it("normalizes the number and returns the assigned value", async () => {
    const target = repository({ outcome: "assigned", participantNumber: "A01" });
    await expect(new AssignParticipantNumber(target).execute(input)).resolves.toEqual({
      ok: true,
      data: { participantNumber: "A01" },
    });
    expect(target.assignParticipantNumber).toHaveBeenCalledWith({ ...input, participantNumber: "A01" });
  });

  it.each([
    ["automatic_mode", "MANUAL_NUMBERING_DISABLED", 409],
    ["invalid_format", "INVALID_PARTICIPANT_NUMBER", 422],
    ["duplicate", "PARTICIPANT_NUMBER_DUPLICATE", 409],
    ["not_found", "NOT_FOUND", 404],
  ] as const)("maps %s without exposing another scope", async (outcome, code, status) => {
    await expect(new AssignParticipantNumber(repository({ outcome })).execute(input)).resolves.toEqual({
      ok: false,
      code,
      status,
    });
  });

  it("returns a changed participant number", async () => {
    await expect(
      new AssignParticipantNumber(repository({ outcome: "assigned", participantNumber: "A02" })).execute(input),
    ).resolves.toEqual({ ok: true, data: { participantNumber: "A02" } });
  });

  it("returns the participant updated by an atomic number swap", async () => {
    await expect(
      new AssignParticipantNumber(
        repository({
          outcome: "assigned",
          participantNumber: "A02",
          swappedParticipantId: "participant-2",
          swappedParticipantNumber: "A01",
        }),
      ).execute(input),
    ).resolves.toEqual({
      ok: true,
      data: {
        participantNumber: "A02",
        swappedParticipantId: "participant-2",
        swappedParticipantNumber: "A01",
      },
    });
  });
});
