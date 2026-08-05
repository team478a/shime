import type { InteractionMemoRepository } from "./repository";
import type {
  InteractionMemoAuditScope,
  InteractionMemoResult,
  InteractionMemoScope,
  InteractionMemoWorkspace,
  SaveInteractionMemoInput,
} from "./types";

export class GetInteractionMemoWorkspace {
  constructor(
    private readonly repository: InteractionMemoRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: InteractionMemoScope): Promise<InteractionMemoResult<InteractionMemoWorkspace>> {
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };
    const snapshot = await this.repository.findActiveSnapshot(scope, this.now());
    if (!snapshot) return { ok: true, data: { enabled: false, options: [], targets: [] } };

    const [options, targets, notes] = await Promise.all([
      this.repository.listOptions(scope, snapshot.id),
      this.repository.listTargets(scope),
      this.repository.listOwnNotes(scope, snapshot.id),
    ]);
    const visibleTargets = targets.filter((target) => Boolean(target.participantNumber?.trim()));
    const noteByTarget = new Map(notes.map((note) => [`${note.interactionSlotId}:${note.targetParticipantId}`, note]));

    return {
      ok: true,
      data: {
        enabled: true,
        snapshotVersion: snapshot.version,
        editableUntil: snapshot.editableUntil?.toISOString() ?? null,
        options,
        targets: visibleTargets.map((target) => ({
          ...target,
          note: noteByTarget.get(`${target.interactionSlotId}:${target.targetParticipantId}`) ?? null,
        })),
      },
    };
  }
}

export class SaveInteractionMemo {
  constructor(
    private readonly repository: InteractionMemoRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    scope: InteractionMemoAuditScope,
    input: SaveInteractionMemoInput,
  ): Promise<InteractionMemoResult<Awaited<ReturnType<InteractionMemoRepository["listOwnNotes"]>>[number]>> {
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };
    if (scope.participantId === input.targetParticipantId)
      return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };

    const now = this.now();
    const snapshot = await this.repository.findActiveSnapshot(scope, now);
    if (!snapshot) return { ok: false, code: "INTERACTION_MEMO_DISABLED", status: 409 };

    const options = await this.repository.listOptions(scope, snapshot.id);
    if (!options.some((option) => option.code === input.feelingCode))
      return { ok: false, code: "INVALID_FEELING_CODE", status: 400 };

    const targets = await this.repository.listTargets(scope);
    if (
      !targets.some(
        (target) =>
          Boolean(target.participantNumber?.trim()) &&
          target.interactionSlotId === input.interactionSlotId &&
          target.targetParticipantId === input.targetParticipantId,
      )
    )
      return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };

    const result = await this.repository.saveOwnNote(scope, snapshot, input, now);
    if (result.status === "saved") return { ok: true, data: result.note };
    if (result.status === "closed") return { ok: false, code: "INTERACTION_MEMO_NOT_OPEN", status: 409 };
    if (result.status === "revision_conflict") return { ok: false, code: "REVISION_CONFLICT", status: 409 };
    return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
  }
}
