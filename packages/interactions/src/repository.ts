import type {
  InteractionMemoAuditScope,
  InteractionMemoNote,
  InteractionMemoOption,
  InteractionMemoScope,
  InteractionMemoSnapshot,
  InteractionMemoTarget,
  SaveInteractionMemoInput,
} from "./types";

export type SaveInteractionMemoRepositoryResult =
  { status: "saved"; note: InteractionMemoNote } | { status: "closed" | "invalid_target" | "revision_conflict" };

export interface InteractionMemoRepository {
  isParticipantEligible(scope: InteractionMemoScope): Promise<boolean>;
  findActiveSnapshot(scope: InteractionMemoScope, now: Date): Promise<InteractionMemoSnapshot | null>;
  listOptions(scope: InteractionMemoScope, snapshotId: string): Promise<InteractionMemoOption[]>;
  listTargets(scope: InteractionMemoScope): Promise<InteractionMemoTarget[]>;
  listOwnNotes(scope: InteractionMemoScope, snapshotId: string): Promise<InteractionMemoNote[]>;
  saveOwnNote(
    scope: InteractionMemoAuditScope,
    snapshot: InteractionMemoSnapshot,
    input: SaveInteractionMemoInput,
    now: Date,
  ): Promise<SaveInteractionMemoRepositoryResult>;
}
