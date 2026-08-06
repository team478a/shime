import { describe, expect, it, vi } from "vitest";
import {
  CreateInteractionMemoDraft,
  InteractionMemoAdminError,
  type InteractionMemoAdminRepository,
  PublishInteractionMemoSnapshot,
  StopInteractionMemoSnapshot,
} from "@shime/interactions";

const scope = {
  tenantId: "tenant-1",
  eventId: "event-1",
  serviceType: "marriage",
  actorUserId: "user-1",
  requestId: "request-1",
};
const snapshot = {
  id: "snapshot-1",
  version: 1,
  status: "draft" as const,
  enabled: false,
  targetSource: "self_reported" as const,
  publicProfileFieldKeys: [],
  editableUntil: null,
  publishedAt: null,
  stoppedAt: null,
  createdAt: "2026-08-06T00:00:00.000Z",
  options: [{ code: "enjoyed", label: "楽しかった", enabled: true, isNegative: false, displayOrder: 1 }],
};

function repository(overrides: Partial<InteractionMemoAdminRepository> = {}): InteractionMemoAdminRepository {
  return {
    listSnapshots: vi.fn(async () => [snapshot]),
    createDraft: vi.fn(async () => ({ status: "updated" as const, snapshot })),
    publish: vi.fn(async () => ({
      status: "updated" as const,
      snapshot: { ...snapshot, status: "published" as const, enabled: true },
    })),
    stop: vi.fn(async () => ({
      status: "updated" as const,
      snapshot: { ...snapshot, status: "stopped" as const },
    })),
    ...overrides,
  };
}

describe("interaction memo admin use cases", () => {
  it("creates a validated immutable draft", async () => {
    const repo = repository();
    await expect(
      new CreateInteractionMemoDraft(repo).execute(scope, {
        targetSource: "self_reported",
        publicProfileFieldKeys: ["nickname"],
        editableUntil: null,
        options: [{ code: "enjoyed", label: "楽しかった", enabled: true, isNegative: false }],
      }),
    ).resolves.toEqual(snapshot);
    expect(repo.createDraft).toHaveBeenCalledOnce();
  });

  it("rejects duplicate or entirely disabled options", async () => {
    const useCase = new CreateInteractionMemoDraft(repository());
    const duplicate = {
      targetSource: "self_reported" as const,
      publicProfileFieldKeys: [],
      editableUntil: null,
      options: [
        { code: "same", label: "A", enabled: true, isNegative: false },
        { code: "same", label: "B", enabled: true, isNegative: false },
      ],
    };
    await expect(useCase.execute(scope, duplicate)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      useCase.execute(scope, { ...duplicate, options: [{ ...duplicate.options[0]!, enabled: false }] }),
    ).rejects.toBeInstanceOf(InteractionMemoAdminError);
  });

  it("maps repository lifecycle conflicts to stable use case errors", async () => {
    const repo = repository({
      publish: vi.fn(async () => ({ status: "invalid_state" as const })),
      stop: vi.fn(async () => ({ status: "snapshot_not_found" as const })),
    });
    await expect(new PublishInteractionMemoSnapshot(repo).execute(scope, snapshot.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(new StopInteractionMemoSnapshot(repo).execute(scope, snapshot.id)).rejects.toMatchObject({
      code: "SNAPSHOT_NOT_FOUND",
    });
  });
});
