import type { InteractionMemoAdminRepository } from "./admin-repository";
import {
  type CreateInteractionMemoDraftInput,
  createInteractionMemoDraftSchema,
  type InteractionMemoAdminScope,
  type InteractionMemoAdminWorkspace,
} from "./admin-types";

export class InteractionMemoAdminError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "EVENT_NOT_FOUND" | "SNAPSHOT_NOT_FOUND" | "INVALID_STATE") {
    super(code);
  }
}

function validateDraft(input: CreateInteractionMemoDraftInput) {
  const parsed = createInteractionMemoDraftSchema.safeParse(input);
  if (!parsed.success) throw new InteractionMemoAdminError("INVALID_INPUT");
  const codes = parsed.data.options.map((option) => option.code);
  if (new Set(codes).size !== codes.length || !parsed.data.options.some((option) => option.enabled)) {
    throw new InteractionMemoAdminError("INVALID_INPUT");
  }
  if (parsed.data.editableUntil && new Date(parsed.data.editableUntil).getTime() <= Date.now()) {
    throw new InteractionMemoAdminError("INVALID_INPUT");
  }
  return parsed.data;
}

function unwrapLifecycle(result: Awaited<ReturnType<InteractionMemoAdminRepository["publish"]>>) {
  if (result.status === "updated") return result.snapshot;
  if (result.status === "event_not_found") throw new InteractionMemoAdminError("EVENT_NOT_FOUND");
  if (result.status === "snapshot_not_found") throw new InteractionMemoAdminError("SNAPSHOT_NOT_FOUND");
  throw new InteractionMemoAdminError("INVALID_STATE");
}

export class ListInteractionMemoSnapshots {
  constructor(private readonly repository: InteractionMemoAdminRepository) {}
  async execute(scope: InteractionMemoAdminScope): Promise<InteractionMemoAdminWorkspace> {
    if (!(await this.repository.eventExists(scope))) throw new InteractionMemoAdminError("EVENT_NOT_FOUND");
    return { snapshots: await this.repository.listSnapshots(scope) };
  }
}

export class CreateInteractionMemoDraft {
  constructor(private readonly repository: InteractionMemoAdminRepository) {}
  async execute(scope: InteractionMemoAdminScope, input: CreateInteractionMemoDraftInput) {
    return unwrapLifecycle(await this.repository.createDraft(scope, validateDraft(input)));
  }
}

export class PublishInteractionMemoSnapshot {
  constructor(private readonly repository: InteractionMemoAdminRepository) {}
  async execute(scope: InteractionMemoAdminScope, snapshotId: string, now = new Date()) {
    return unwrapLifecycle(await this.repository.publish(scope, snapshotId, now));
  }
}

export class StopInteractionMemoSnapshot {
  constructor(private readonly repository: InteractionMemoAdminRepository) {}
  async execute(scope: InteractionMemoAdminScope, snapshotId: string, now = new Date()) {
    return unwrapLifecycle(await this.repository.stop(scope, snapshotId, now));
  }
}
