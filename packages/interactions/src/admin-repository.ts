import type {
  CreateInteractionMemoDraftInput,
  InteractionMemoAdminScope,
  InteractionMemoAdminSnapshot,
} from "./admin-types";

export type InteractionMemoLifecycleResult =
  | { status: "updated"; snapshot: InteractionMemoAdminSnapshot }
  | { status: "event_not_found" | "snapshot_not_found" | "invalid_state" };

export interface InteractionMemoAdminRepository {
  eventExists(scope: InteractionMemoAdminScope): Promise<boolean>;
  listSnapshots(scope: InteractionMemoAdminScope): Promise<InteractionMemoAdminSnapshot[]>;
  createDraft(
    scope: InteractionMemoAdminScope,
    input: CreateInteractionMemoDraftInput,
  ): Promise<InteractionMemoLifecycleResult>;
  publish(scope: InteractionMemoAdminScope, snapshotId: string, now: Date): Promise<InteractionMemoLifecycleResult>;
  stop(scope: InteractionMemoAdminScope, snapshotId: string, now: Date): Promise<InteractionMemoLifecycleResult>;
}
