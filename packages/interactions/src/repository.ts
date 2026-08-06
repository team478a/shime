import type {
  InteractionMemoAuditScope,
  InteractionMemoNote,
  InteractionMemoOption,
  InteractionMemoScope,
  InteractionMemoSnapshot,
  InteractionMemoTarget,
  InteractionMemoTargetCandidate,
  SaveInteractionMemoInput,
} from "./types";

export type SaveInteractionMemoRepositoryResult =
  { status: "saved"; note: InteractionMemoNote } | { status: "closed" | "invalid_target" | "revision_conflict" };

export type CreateSelfReportedSlotRepositoryResult =
  { status: "created" | "existing"; target: InteractionMemoTarget } | { status: "closed" | "invalid_target" };

export type CancelSelfReportedSlotRepositoryResult =
  { status: "cancelled" } | { status: "closed" | "invalid_target" | "has_notes" };

export interface InteractionMemoRepository {
  isParticipantEligible(scope: InteractionMemoScope): Promise<boolean>;
  findActiveSnapshot(scope: InteractionMemoScope, now: Date): Promise<InteractionMemoSnapshot | null>;
  listOptions(scope: InteractionMemoScope, snapshotId: string): Promise<InteractionMemoOption[]>;
  listTargets(scope: InteractionMemoScope): Promise<InteractionMemoTarget[]>;
  listOwnNotes(scope: InteractionMemoScope, snapshotId: string): Promise<InteractionMemoNote[]>;
  searchSelfReportedCandidates(
    scope: InteractionMemoScope,
    participantNumberPrefix: string,
    limit: number,
  ): Promise<InteractionMemoTargetCandidate[]>;
  createSelfReportedSlot(
    scope: InteractionMemoAuditScope,
    snapshot: InteractionMemoSnapshot,
    targetParticipantId: string,
    now: Date,
  ): Promise<CreateSelfReportedSlotRepositoryResult>;
  cancelSelfReportedSlot(
    scope: InteractionMemoAuditScope,
    snapshot: InteractionMemoSnapshot,
    interactionSlotId: string,
    targetParticipantId: string,
    now: Date,
  ): Promise<CancelSelfReportedSlotRepositoryResult>;
  saveOwnNote(
    scope: InteractionMemoAuditScope,
    snapshot: InteractionMemoSnapshot,
    input: SaveInteractionMemoInput,
    now: Date,
  ): Promise<SaveInteractionMemoRepositoryResult>;
}
