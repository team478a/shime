export type InteractionMemoOptionDto = {
  code: string;
  label: string;
  displayOrder: number;
  isNegative: boolean;
};

export type InteractionMemoNoteDto = {
  id: string;
  interactionSlotId: string;
  targetParticipantId: string;
  feelingCode: string;
  favorite: boolean;
  revision: number;
  savedAt: string;
};

export type InteractionMemoTargetDto = {
  interactionSlotId: string;
  targetParticipantId: string;
  participantNumber: string | null;
  roundNo: number | null;
  note: InteractionMemoNoteDto | null;
};

export type InteractionMemoWorkspaceDto = {
  enabled: boolean;
  snapshotVersion?: number;
  editableUntil?: string | null;
  options: InteractionMemoOptionDto[];
  targets: InteractionMemoTargetDto[];
};

export function interactionMemoTargetKey(
  target: Pick<InteractionMemoTargetDto, "interactionSlotId" | "targetParticipantId">,
) {
  return `${target.interactionSlotId}:${target.targetParticipantId}`;
}

export function replaceInteractionMemoNote(
  workspace: InteractionMemoWorkspaceDto,
  key: string,
  note: InteractionMemoNoteDto,
): InteractionMemoWorkspaceDto {
  return {
    ...workspace,
    targets: workspace.targets.map((target) =>
      interactionMemoTargetKey(target) === key ? { ...target, note } : target,
    ),
  };
}

export function getDisplayableInteractionMemoTargets(
  workspace: Pick<InteractionMemoWorkspaceDto, "targets"> | null | undefined,
): Array<InteractionMemoTargetDto & { participantNumber: string }> {
  return (workspace?.targets ?? []).filter(
    (target): target is InteractionMemoTargetDto & { participantNumber: string } =>
      Boolean(target.participantNumber?.trim()),
  );
}

export function formatInteractionMemoSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
