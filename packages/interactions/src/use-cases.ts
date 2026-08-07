import type { InteractionMemoRepository } from "./repository";
import type {
  InteractionMemoAuditScope,
  InteractionMemoResult,
  InteractionMemoScope,
  InteractionMemoTarget,
  InteractionMemoTargetCandidate,
  InteractionMemoWorkspace,
  InteractionPreferenceHints,
  InteractionPublicProfile,
  SaveInteractionMemoInput,
} from "./types";
import { buildInteractionPublicProfile } from "./public-profile";

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
        targetSource: snapshot.targetSource,
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

export class GetInteractionPreferenceHints {
  constructor(private readonly repository: InteractionMemoRepository) {}

  async execute(scope: InteractionMemoScope): Promise<InteractionMemoResult<InteractionPreferenceHints>> {
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };

    const [targets, wantsToTalkMoreTargetIds] = await Promise.all([
      this.repository.listTargets(scope),
      this.repository.listOwnWantsToTalkMoreTargetIds(scope),
    ]);
    const targetParticipantIds = [...new Set(targets.map((target) => target.targetParticipantId))];
    const allowedTargets = new Set(targetParticipantIds);

    return {
      ok: true,
      data: {
        targetParticipantIds,
        wantsToTalkMoreTargetIds: wantsToTalkMoreTargetIds.filter((id) => allowedTargets.has(id)),
      },
    };
  }
}

export class SearchSelfReportedInteractionTargets {
  constructor(
    private readonly repository: InteractionMemoRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    scope: InteractionMemoScope,
    participantNumberPrefix: string,
  ): Promise<InteractionMemoResult<InteractionMemoTargetCandidate[]>> {
    const query = participantNumberPrefix.trim();
    if (query.length < 1 || query.length > 20)
      return { ok: false, code: "INTERACTION_TARGET_QUERY_INVALID", status: 400 };
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };
    const snapshot = await this.repository.findActiveSnapshot(scope, this.now());
    if (!snapshot || snapshot.targetSource !== "self_reported")
      return { ok: false, code: "INTERACTION_MEMO_DISABLED", status: 409 };

    const [candidates, registeredTargets] = await Promise.all([
      this.repository.searchSelfReportedCandidates(scope, query, 50),
      this.repository.listTargets(scope),
    ]);
    const registered = new Set(registeredTargets.map((target) => target.targetParticipantId));
    return {
      ok: true,
      data: candidates.filter((candidate) => !registered.has(candidate.targetParticipantId)).slice(0, 10),
    };
  }
}

export class GetInteractionPublicProfile {
  constructor(
    private readonly repository: InteractionMemoRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    scope: InteractionMemoScope,
    targetParticipantId: string,
  ): Promise<InteractionMemoResult<InteractionPublicProfile>> {
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };
    if (scope.participantId === targetParticipantId)
      return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
    const snapshot = await this.repository.findActiveSnapshot(scope, this.now());
    if (!snapshot) return { ok: false, code: "INTERACTION_MEMO_DISABLED", status: 409 };
    const targets = await this.repository.listTargets(scope);
    if (!targets.some((target) => target.targetParticipantId === targetParticipantId))
      return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
    const source = await this.repository.getTargetPublicProfileSource(scope, targetParticipantId);
    if (!source) return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
    return { ok: true, data: buildInteractionPublicProfile(source, snapshot.publicProfileFieldKeys, this.now()) };
  }
}

export class CreateSelfReportedInteractionSlot {
  constructor(
    private readonly repository: InteractionMemoRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    scope: InteractionMemoAuditScope,
    targetParticipantId: string,
  ): Promise<InteractionMemoResult<InteractionMemoTarget>> {
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };
    if (scope.participantId === targetParticipantId)
      return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
    const now = this.now();
    const snapshot = await this.repository.findActiveSnapshot(scope, now);
    if (!snapshot || snapshot.targetSource !== "self_reported")
      return { ok: false, code: "INTERACTION_MEMO_DISABLED", status: 409 };
    const result = await this.repository.createSelfReportedSlot(scope, snapshot, targetParticipantId, now);
    if (result.status === "created" || result.status === "existing") return { ok: true, data: result.target };
    if (result.status === "closed") return { ok: false, code: "INTERACTION_MEMO_NOT_OPEN", status: 409 };
    return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
  }
}

export class CancelSelfReportedInteractionSlot {
  constructor(
    private readonly repository: InteractionMemoRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    scope: InteractionMemoAuditScope,
    interactionSlotId: string,
    targetParticipantId: string,
  ): Promise<InteractionMemoResult<{ interactionSlotId: string }>> {
    if (!(await this.repository.isParticipantEligible(scope)))
      return { ok: false, code: "PARTICIPATION_NOT_CONFIRMED", status: 409 };
    const now = this.now();
    const snapshot = await this.repository.findActiveSnapshot(scope, now);
    if (!snapshot || snapshot.targetSource !== "self_reported")
      return { ok: false, code: "INTERACTION_MEMO_DISABLED", status: 409 };
    const result = await this.repository.cancelSelfReportedSlot(
      scope,
      snapshot,
      interactionSlotId,
      targetParticipantId,
      now,
    );
    if (result.status === "cancelled") return { ok: true, data: { interactionSlotId } };
    if (result.status === "has_notes") return { ok: false, code: "INTERACTION_TARGET_HAS_NOTE", status: 409 };
    if (result.status === "closed") return { ok: false, code: "INTERACTION_MEMO_NOT_OPEN", status: 409 };
    return { ok: false, code: "INTERACTION_TARGET_NOT_ALLOWED", status: 404 };
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
