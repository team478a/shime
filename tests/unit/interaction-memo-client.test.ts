import { describe, expect, it } from "vitest";
import {
  formatInteractionMemoSavedAt,
  getDisplayableInteractionMemoTargets,
  interactionMemoTargetKey,
  participantNumberDisplay,
  type InteractionMemoWorkspaceDto,
  replaceInteractionMemoNote,
} from "../../apps/web/src/lib/interaction-memo-client";

const workspace: InteractionMemoWorkspaceDto = {
  enabled: true,
  options: [],
  targets: [
    {
      interactionSlotId: "slot-1",
      targetParticipantId: "participant-2",
      participantNumber: "B01",
      roundNo: 1,
      note: null,
    },
    {
      interactionSlotId: "slot-2",
      targetParticipantId: "participant-3",
      participantNumber: "B02",
      roundNo: 2,
      note: null,
    },
  ],
};

describe("interaction memo client state", () => {
  it("updates only the selected private target card", () => {
    const note = {
      id: "note-1",
      interactionSlotId: "slot-1",
      targetParticipantId: "participant-2",
      feelingCode: "reassured",
      favorite: true,
      revision: 1,
      savedAt: "2026-08-08T05:10:00.000Z",
    };
    const next = replaceInteractionMemoNote(workspace, interactionMemoTargetKey(workspace.targets[0]!), note);

    expect(next.targets[0]?.note).toEqual(note);
    expect(next.targets[1]?.note).toBeNull();
    expect(workspace.targets[0]?.note).toBeNull();
  });

  it("formats saved time in Japan without exposing a date or locale-dependent seconds", () => {
    expect(formatInteractionMemoSavedAt("2026-08-08T05:10:00.000Z")).toBe("14:10");
    expect(formatInteractionMemoSavedAt("invalid")).toBe("");
  });

  it("shows the shared badge number while retaining the category prefix internally", () => {
    expect(participantNumberDisplay("A01")).toBe("1");
    expect(participantNumberDisplay("B16")).toBe("16");
    expect(participantNumberDisplay("SPECIAL")).toBe("SPECIAL");
  });

  it("does not offer a target that cannot be identified by participant number", () => {
    const targets = getDisplayableInteractionMemoTargets({
      targets: [
        ...workspace.targets,
        {
          interactionSlotId: "slot-3",
          targetParticipantId: "participant-4",
          participantNumber: null,
          roundNo: 3,
          note: null,
        },
      ],
    });

    expect(targets.map((target) => target.participantNumber)).toEqual(["B01", "B02"]);
  });
});
