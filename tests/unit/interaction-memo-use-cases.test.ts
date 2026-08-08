import { describe, expect, it, vi } from "vitest";
import {
  CancelSelfReportedInteractionSlot,
  CreateSelfReportedInteractionSlot,
  GetInteractionMemoWorkspace,
  type InteractionMemoNote,
  type InteractionMemoRepository,
  interactionPublicProfileFieldKeysSchema,
  SaveInteractionMemo,
  SearchSelfReportedInteractionTargets,
} from "@shime/interactions";

const now = new Date("2026-08-08T06:00:00.000Z");
const scope = {
  tenantId: "tenant-1",
  eventId: "event-1",
  serviceType: "marriage",
  participantId: "participant-1",
};
const auditScope = { ...scope, actorUserId: "user-1", requestId: "request-1" };
const snapshot = {
  id: "snapshot-1",
  version: 1,
  targetSource: "interaction_slot" as const,
  publicProfileFieldKeys: [],
  editableUntil: new Date("2026-08-08T09:00:00.000Z"),
};
const selfReportedSnapshot = { ...snapshot, targetSource: "self_reported" as const };
const option = { code: "comfortable", label: "話しやすかった", displayOrder: 1, isNegative: false };
const target = {
  interactionSlotId: "slot-1",
  targetParticipantId: "participant-2",
  participantNumber: "B01",
  roundNo: 1,
};
const note: InteractionMemoNote = {
  id: "note-1",
  interactionSlotId: target.interactionSlotId,
  targetParticipantId: target.targetParticipantId,
  feelingCode: option.code,
  favorite: true,
  revision: 1,
  savedAt: now,
};

function repository(overrides: Partial<InteractionMemoRepository> = {}): InteractionMemoRepository {
  return {
    isParticipantEligible: async () => true,
    findActiveSnapshot: async () => snapshot,
    listOptions: async () => [option],
    listTargets: async () => [target],
    listOwnNotes: async () => [],
    getTargetPublicProfileSource: async () => null,
    searchSelfReportedCandidates: async () => [],
    createSelfReportedSlot: async () => ({ status: "created", target }),
    cancelSelfReportedSlot: async () => ({ status: "cancelled" }),
    saveOwnNote: async () => ({ status: "saved", note }),
    ...overrides,
  };
}

describe("interaction memo use cases", () => {
  it("accepts only the fixed public profile allowlist without duplicates", () => {
    const keys = [
      "nickname",
      "age_or_band",
      "residence_municipality",
      "occupation",
      "hobbies",
      "holiday_style",
      "support_wanted",
      "support_offered",
      "public_dream",
    ];
    expect(interactionPublicProfileFieldKeysSchema.parse(keys)).toEqual(keys);
    expect(() => interactionPublicProfileFieldKeysSchema.parse(["full_name"])).toThrow();
    expect(() => interactionPublicProfileFieldKeysSchema.parse(["nickname", "nickname"])).toThrow();
  });

  it("rejects a cancelled or absent actor before returning private memo data", async () => {
    const listOwnNotes = vi.fn(async () => [note]);
    const useCase = new GetInteractionMemoWorkspace(
      repository({ isParticipantEligible: async () => false, listOwnNotes }),
      () => now,
    );

    await expect(useCase.execute(scope)).resolves.toEqual({
      ok: false,
      code: "PARTICIPATION_NOT_CONFIRMED",
      status: 409,
    });
    expect(listOwnNotes).not.toHaveBeenCalled();
  });

  it("is disabled by default when no event snapshot is active", async () => {
    const useCase = new GetInteractionMemoWorkspace(repository({ findActiveSnapshot: async () => null }), () => now);

    await expect(useCase.execute(scope)).resolves.toEqual({
      ok: true,
      data: { enabled: false, options: [], targets: [] },
    });
  });

  it("returns only notes supplied for the signed-in actor and matching target", async () => {
    const useCase = new GetInteractionMemoWorkspace(repository({ listOwnNotes: async () => [note] }), () => now);

    const result = await useCase.execute(scope);

    expect(result).toEqual({
      ok: true,
      data: {
        enabled: true,
        snapshotVersion: 1,
        targetSource: "interaction_slot",
        editableUntil: snapshot.editableUntil?.toISOString(),
        options: [option],
        targets: [{ ...target, note }],
      },
    });
  });

  it("does not expose an unnumbered participant as an actionable target", async () => {
    const unnumberedTarget = { ...target, targetParticipantId: "participant-3", participantNumber: null };
    const useCase = new GetInteractionMemoWorkspace(
      repository({ listTargets: async () => [target, unnumberedTarget] }),
      () => now,
    );

    const result = await useCase.execute(scope);

    expect(result.ok && result.data.targets).toEqual([{ ...target, note: null }]);
  });

  it("rejects self selection before repository mutation", async () => {
    const saveOwnNote = vi.fn(async () => ({ status: "saved" as const, note }));
    const useCase = new SaveInteractionMemo(repository({ saveOwnNote }), () => now);

    await expect(
      useCase.execute(auditScope, {
        interactionSlotId: "slot-1",
        targetParticipantId: scope.participantId,
        feelingCode: option.code,
        favorite: false,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 });
    expect(saveOwnNote).not.toHaveBeenCalled();
  });

  it("rejects an option outside the immutable event snapshot", async () => {
    const saveOwnNote = vi.fn(async () => ({ status: "saved" as const, note }));
    const useCase = new SaveInteractionMemo(repository({ saveOwnNote }), () => now);

    await expect(
      useCase.execute(auditScope, {
        interactionSlotId: target.interactionSlotId,
        targetParticipantId: target.targetParticipantId,
        feelingCode: "not-in-snapshot",
        favorite: false,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: false, code: "INVALID_FEELING_CODE", status: 400 });
    expect(saveOwnNote).not.toHaveBeenCalled();
  });

  it("rejects a participant who is not in the actor's actual interaction slot", async () => {
    const saveOwnNote = vi.fn(async () => ({ status: "saved" as const, note }));
    const useCase = new SaveInteractionMemo(repository({ saveOwnNote }), () => now);

    await expect(
      useCase.execute(auditScope, {
        interactionSlotId: target.interactionSlotId,
        targetParticipantId: "participant-3",
        feelingCode: option.code,
        favorite: false,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 });
    expect(saveOwnNote).not.toHaveBeenCalled();
  });

  it("rejects an unnumbered target even when the repository returns its slot membership", async () => {
    const unnumberedTarget = { ...target, participantNumber: null };
    const saveOwnNote = vi.fn(async () => ({ status: "saved" as const, note }));
    const useCase = new SaveInteractionMemo(
      repository({ listTargets: async () => [unnumberedTarget], saveOwnNote }),
      () => now,
    );

    await expect(
      useCase.execute(auditScope, {
        interactionSlotId: target.interactionSlotId,
        targetParticipantId: target.targetParticipantId,
        feelingCode: option.code,
        favorite: false,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 });
    expect(saveOwnNote).not.toHaveBeenCalled();
  });

  it("preserves revision conflicts from the atomic repository update", async () => {
    const useCase = new SaveInteractionMemo(
      repository({ saveOwnNote: async () => ({ status: "revision_conflict" }) }),
      () => now,
    );

    await expect(
      useCase.execute(auditScope, {
        interactionSlotId: target.interactionSlotId,
        targetParticipantId: target.targetParticipantId,
        feelingCode: option.code,
        favorite: true,
        expectedRevision: 1,
      }),
    ).resolves.toEqual({ ok: false, code: "REVISION_CONFLICT", status: 409 });
  });

  it("searches self-reported candidates by prefix and removes already registered targets", async () => {
    const searchSelfReportedCandidates = vi.fn(async () => [
      { targetParticipantId: target.targetParticipantId, participantNumber: "B01" },
      { targetParticipantId: "participant-3", participantNumber: "B02" },
    ]);
    const useCase = new SearchSelfReportedInteractionTargets(
      repository({ findActiveSnapshot: async () => selfReportedSnapshot, searchSelfReportedCandidates }),
      () => now,
    );

    await expect(useCase.execute(scope, " B ")).resolves.toEqual({
      ok: true,
      data: [{ targetParticipantId: "participant-3", participantNumber: "B02" }],
    });
    expect(searchSelfReportedCandidates).toHaveBeenCalledWith(scope, "B", 50);
  });

  it("lists available opposite-category candidates without requiring typed input", async () => {
    const candidates = Array.from({ length: 16 }, (_, index) => ({
      targetParticipantId: `participant-${index + 10}`,
      participantNumber: `B${String(index + 1).padStart(2, "0")}`,
    }));
    const searchSelfReportedCandidates = vi.fn(async () => candidates);
    const useCase = new SearchSelfReportedInteractionTargets(
      repository({ findActiveSnapshot: async () => selfReportedSnapshot, searchSelfReportedCandidates }),
      () => now,
    );

    await expect(useCase.execute(scope, "")).resolves.toEqual({ ok: true, data: candidates });
    expect(searchSelfReportedCandidates).toHaveBeenCalledWith(scope, "", 50);
  });

  it("does not search candidates for a non-self-reported snapshot", async () => {
    const searchSelfReportedCandidates = vi.fn(async () => []);
    const useCase = new SearchSelfReportedInteractionTargets(repository({ searchSelfReportedCandidates }), () => now);

    await expect(useCase.execute(scope, "B")).resolves.toEqual({
      ok: false,
      code: "INTERACTION_MEMO_DISABLED",
      status: 409,
    });
    expect(searchSelfReportedCandidates).not.toHaveBeenCalled();
  });

  it("creates an idempotent self-reported slot only for an active self-reported snapshot", async () => {
    const createSelfReportedSlot = vi.fn(async () => ({ status: "existing" as const, target }));
    const useCase = new CreateSelfReportedInteractionSlot(
      repository({ findActiveSnapshot: async () => selfReportedSnapshot, createSelfReportedSlot }),
      () => now,
    );

    await expect(useCase.execute(auditScope, target.targetParticipantId)).resolves.toEqual({ ok: true, data: target });
    expect(createSelfReportedSlot).toHaveBeenCalledWith(
      auditScope,
      selfReportedSnapshot,
      target.targetParticipantId,
      now,
    );
  });

  it("prevents cancelling a self-reported target after either participant has entered a note", async () => {
    const useCase = new CancelSelfReportedInteractionSlot(
      repository({
        findActiveSnapshot: async () => selfReportedSnapshot,
        cancelSelfReportedSlot: async () => ({ status: "has_notes" }),
      }),
      () => now,
    );

    await expect(useCase.execute(auditScope, target.interactionSlotId, target.targetParticipantId)).resolves.toEqual({
      ok: false,
      code: "INTERACTION_TARGET_HAS_NOTE",
      status: 409,
    });
  });

  it("does not cancel a self-reported target for an ineligible participant", async () => {
    const cancelSelfReportedSlot = vi.fn(async () => ({ status: "cancelled" as const }));
    const useCase = new CancelSelfReportedInteractionSlot(
      repository({ isParticipantEligible: async () => false, cancelSelfReportedSlot }),
      () => now,
    );

    await expect(useCase.execute(auditScope, target.interactionSlotId, target.targetParticipantId)).resolves.toEqual({
      ok: false,
      code: "PARTICIPATION_NOT_CONFIRMED",
      status: 409,
    });
    expect(cancelSelfReportedSlot).not.toHaveBeenCalled();
  });
});
