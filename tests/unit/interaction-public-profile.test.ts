import { describe, expect, it, vi } from "vitest";
import {
  buildInteractionPublicProfile,
  calculateAge,
  GetInteractionPublicProfile,
  type InteractionMemoRepository,
} from "@shime/interactions";

const now = new Date("2026-08-08T06:00:00.000Z");
const scope = {
  tenantId: "tenant-1",
  eventId: "event-1",
  serviceType: "marriage",
  participantId: "participant-1",
};
const target = {
  interactionSlotId: "slot-1",
  targetParticipantId: "participant-2",
  participantNumber: "B01",
  roundNo: 1,
};
const source = {
  participantNumber: "B01",
  nickname: "はな",
  birthDate: "1991-10-20",
  residenceArea: "愛知県名古屋市中区栄3-1-1",
  additionalAnswers: {
    occupation: "会社員",
    hobbies: "読書",
    recent_happy_event: "友人と再会した",
    today_message: "よろしくお願いします",
    email: "secret@example.com",
  },
  publicDream: "小さな店を開く",
};

function repository(overrides: Partial<InteractionMemoRepository> = {}): InteractionMemoRepository {
  return {
    isParticipantEligible: async () => true,
    findActiveSnapshot: async () => ({
      id: "snapshot-1",
      version: 1,
      targetSource: "interaction_slot",
      publicProfileFieldKeys: ["nickname", "public_dream"],
      editableUntil: null,
    }),
    listOptions: async () => [],
    listTargets: async () => [target],
    listOwnNotes: async () => [],
    getTargetPublicProfileSource: async () => source,
    searchSelfReportedCandidates: async () => [],
    createSelfReportedSlot: async () => ({ status: "invalid_target" }),
    cancelSelfReportedSlot: async () => ({ status: "invalid_target" }),
    saveOwnNote: async () => ({ status: "invalid_target" }),
    ...overrides,
  };
}

describe("interaction public profile", () => {
  it("uses only the allowlist without exact age, address, or private fields", () => {
    const profile = buildInteractionPublicProfile(
      { ...source, publicDream: null },
      ["nickname", "age_or_band", "residence_municipality", "occupation", "public_dream"],
      now,
    );

    expect(profile).toEqual({
      participantNumber: "B01",
      fields: [
        { key: "nickname", label: "ニックネーム", value: "はな" },
        { key: "age_or_band", label: "年代", value: "30代" },
        { key: "residence_municipality", label: "居住地域", value: "愛知県名古屋市中区" },
        { key: "occupation", label: "職業", value: "会社員" },
      ],
    });
    expect(JSON.stringify(profile)).not.toContain("1991-10-20");
    expect(JSON.stringify(profile)).not.toContain("secret@example.com");
    expect(JSON.stringify(profile)).not.toContain("栄3-1-1");
  });

  it("derives exact age without exposing birth date and returns the new allowlisted answers", () => {
    const profile = buildInteractionPublicProfile(source, ["age", "recent_happy_event", "today_message"], now);

    expect(calculateAge("1991-10-20", now)).toBe(34);
    expect(profile).toEqual({
      participantNumber: "B01",
      fields: [
        { key: "age", label: "年齢", value: "34歳" },
        { key: "recent_happy_event", label: "最近あった嬉しいこと", value: "友人と再会した" },
        { key: "today_message", label: "今日の一言", value: "よろしくお願いします" },
      ],
    });
    expect(JSON.stringify(profile)).not.toContain("1991-10-20");
  });

  it("returns a profile only for a current eligible conversation target", async () => {
    const getTargetPublicProfileSource = vi.fn(async () => source);
    const useCase = new GetInteractionPublicProfile(repository({ getTargetPublicProfileSource }), () => now);

    await expect(useCase.execute(scope, target.targetParticipantId)).resolves.toEqual({
      ok: true,
      data: {
        participantNumber: "B01",
        fields: [
          { key: "nickname", label: "ニックネーム", value: "はな" },
          { key: "public_dream", label: "Dream", value: "小さな店を開く" },
        ],
      },
    });
    expect(getTargetPublicProfileSource).toHaveBeenCalledWith(scope, target.targetParticipantId);
  });

  it("hides profiles for another slot or an avoidance-filtered target", async () => {
    const getTargetPublicProfileSource = vi.fn();
    const useCase = new GetInteractionPublicProfile(
      repository({ listTargets: async () => [], getTargetPublicProfileSource }),
      () => now,
    );

    await expect(useCase.execute(scope, "participant-3")).resolves.toEqual({
      ok: false,
      code: "INTERACTION_TARGET_NOT_ALLOWED",
      status: 404,
    });
    expect(getTargetPublicProfileSource).not.toHaveBeenCalled();
  });
});
