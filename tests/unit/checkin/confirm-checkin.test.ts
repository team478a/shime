import { describe, expect, it, vi } from "vitest";

import { ConfirmCheckin } from "@shime/checkin/confirm-checkin";
import type { CheckinRepository } from "@shime/checkin/checkin-repository";
import type { ConfirmCheckinInput, ConfirmedCheckin } from "@shime/checkin/checkin-types";

const input: ConfirmCheckinInput = {
  tenantId: "tenant-1",
  eventId: "event-1",
  participantId: "participant-1",
  actorUserId: "staff-1",
  method: "manual",
  requestId: "request-1",
  now: new Date("2026-08-08T01:00:00.000Z"),
};

const confirmed: ConfirmedCheckin = {
  id: "checkin-1",
  tenantId: input.tenantId,
  eventId: input.eventId,
  participantId: input.participantId,
  status: "checked_in",
  checkedInAt: input.now,
  checkedInBy: input.actorUserId,
  method: input.method,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  receptionCategory: "group_a",
  receptionCategoryLabel: "グループA",
  receptionNumber: 1,
  createdAt: input.now,
  updatedAt: input.now,
};

describe("ConfirmCheckin", () => {
  it("returns the confirmed reception number", async () => {
    const repository: CheckinRepository = {
      confirm: vi.fn().mockResolvedValue({ outcome: "confirmed", checkin: confirmed }),
    };

    await expect(new ConfirmCheckin(repository).execute(input)).resolves.toEqual({
      ok: true,
      data: confirmed,
    });
    expect(repository.confirm).toHaveBeenCalledWith(input);
  });

  it("keeps the existing already-checked-in contract", async () => {
    const checkedInAt = new Date("2026-08-08T00:55:00.000Z");
    const repository: CheckinRepository = {
      confirm: vi.fn().mockResolvedValue({ outcome: "already_checked_in", checkedInAt }),
    };

    await expect(new ConfirmCheckin(repository).execute(input)).resolves.toEqual({
      ok: false,
      code: "ALREADY_CHECKED_IN",
      status: 409,
      data: { checkedInAt },
    });
  });

  it("returns not found without exposing another scope", async () => {
    const repository: CheckinRepository = {
      confirm: vi.fn().mockResolvedValue({ outcome: "not_found" }),
    };

    await expect(new ConfirmCheckin(repository).execute(input)).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
