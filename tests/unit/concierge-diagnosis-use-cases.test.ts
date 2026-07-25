import { describe, expect, it, vi } from "vitest";

import { CONCIERGE_TEMPLATE_SCHEMA_VERSION, type ConciergeTemplatePayload } from "@shime/core";
import {
  type ConciergeDiagnosisRepository,
  createDeterministicDiagnosisResult,
  type DiagnosisAnswer,
  type DiagnosisConfiguration,
  type DiagnosisScope,
  type DiagnosisSession,
  GetDiagnosis,
  parseActiveDiagnosis,
  SaveDiagnosisDraft,
  StartDiagnosis,
  SubmitDiagnosis,
  UpdateDiagnosisEventSettings,
} from "@shime/concierge";

const now = new Date("2026-07-25T00:00:00.000Z");
const scope: DiagnosisScope = {
  tenantId: "tenant-1",
  eventId: "event-1",
  participantId: "participant-1",
  userId: "user-1",
};

function cardId(index: number) {
  return `00000000-0000-4000-8000-00000000000${index}`;
}

function validTemplate(overrides: Partial<ConciergeTemplatePayload> = {}): ConciergeTemplatePayload {
  return {
    schemaVersion: CONCIERGE_TEMPLATE_SCHEMA_VERSION,
    copy: {
      pageTitle: "",
      intro: "",
      instructions: "",
      completionTitle: "",
      completionBody: "",
      startButton: "",
      nextButton: "",
      backButton: "",
      completeButton: "",
    },
    reportCopy: { title: "", heading: "", fixedText: "", disclaimer: "", guidance: "" },
    protectedMessageKeys: [],
    questions: Array.from({ length: 4 }, (_, index) => ({
      axisCode: `axis_${index + 1}`,
      prompt: `設問${index + 1}`,
      supplementalText: "",
      required: true,
      displayOrder: index + 1,
      options: [
        { code: "opt_a", label: "選択肢A", displayOrder: 1 },
        { code: "opt_b", label: "選択肢B", displayOrder: 2 },
      ],
    })),
    emotions: Array.from({ length: 8 }, (_, index) => ({
      code: `emotion_${index + 1}`,
      label: `感情${index + 1}`,
      description: "",
      displayOrder: index + 1,
      active: true,
    })),
    cardMappings: Array.from({ length: 8 }, (_, index) => ({
      cardAssetVersionId: cardId(index + 1),
      emotionCode: `emotion_${index + 1}`,
      displayOrder: index + 1,
      active: true,
    })),
    ...overrides,
  };
}

function validCards() {
  return Array.from({ length: 8 }, (_, index) => ({
    id: cardId(index + 1),
    assetId: cardId(index + 1),
    version: 1,
    title: `カード${index + 1}`,
    message: `メッセージ${index + 1}`,
    altText: `カード${index + 1}の説明`,
    storageObjectKey: `concierge/cards/${index + 1}.webp`,
    mimeType: "image/webp",
    contentHash: "a".repeat(64),
    width: 512,
    height: 512,
  }));
}

function rawSnapshot(
  overrides: { template?: Partial<ConciergeTemplatePayload>; cards?: ReturnType<typeof validCards> } = {},
) {
  return {
    schemaVersion: 1,
    template: { ...validTemplate(), ...overrides.template },
    cards: overrides.cards ?? validCards(),
  };
}

function configuration(overrides: Partial<DiagnosisConfiguration> = {}): DiagnosisConfiguration {
  return {
    id: "config-1",
    snapshotHash: "b".repeat(64),
    snapshot: rawSnapshot(),
    enabled: true,
    accessOpensAt: null,
    accessClosesAt: null,
    allowResubmission: false,
    ...overrides,
  };
}

function session(overrides: Partial<DiagnosisSession> = {}): DiagnosisSession {
  return {
    id: "session-1",
    snapshotId: "config-1",
    status: "in_progress",
    revision: 0,
    selectedCardAssetVersionId: null,
    startedAt: now,
    submittedAt: null,
    ...overrides,
  };
}

function repository(overrides: Partial<ConciergeDiagnosisRepository> = {}): ConciergeDiagnosisRepository {
  return {
    findConfiguration: async () => configuration(),
    findSession: async () => null,
    listAnswers: async () => [],
    findLatestResult: async () => null,
    createSession: async (_scope, snapshotId, startedAt) => session({ snapshotId, startedAt }),
    reopenSession: async () => null,
    saveDraft: async () => null,
    submit: async () => null,
    logAccess: async () => undefined,
    getCardObjectKey: async () => null,
    updateEventSettings: async () => null,
    getStatusSummary: async () => null,
    ...overrides,
  };
}

const answers: DiagnosisAnswer[] = Array.from({ length: 4 }, (_, index) => ({
  axisCode: `axis_${index + 1}`,
  optionCode: "opt_a",
}));

describe("parseActiveDiagnosis", () => {
  it("parses a valid snapshot into four axes, eight emotions, and eight non-duplicate cards", () => {
    const diagnosis = parseActiveDiagnosis(rawSnapshot());
    expect(diagnosis).not.toBeNull();
    expect(diagnosis?.questions).toHaveLength(4);
    expect(diagnosis?.emotions).toHaveLength(8);
    expect(diagnosis?.cards).toHaveLength(8);
    expect(new Set(diagnosis?.cards.map((card) => card.id)).size).toBe(8);
    expect(new Set(diagnosis?.cards.map((card) => card.emotionCode)).size).toBe(8);
  });

  it("rejects a snapshot with fewer than four question axes", () => {
    const snapshot = rawSnapshot({ template: { questions: validTemplate().questions.slice(0, 3) } });
    expect(parseActiveDiagnosis(snapshot)).toBeNull();
  });

  it("rejects a snapshot with fewer than eight active emotions", () => {
    const template = validTemplate();
    const snapshot = rawSnapshot({
      template: {
        emotions: template.emotions.map((emotion, index) => (index === 0 ? { ...emotion, active: false } : emotion)),
      },
    });
    expect(parseActiveDiagnosis(snapshot)).toBeNull();
  });

  it("rejects a snapshot where two active card mappings reference the same card asset", () => {
    const template = validTemplate();
    const duplicated = template.cardMappings.map((mapping, index) =>
      index === 1 ? { ...mapping, cardAssetVersionId: template.cardMappings[0]!.cardAssetVersionId } : mapping,
    );
    expect(parseActiveDiagnosis(rawSnapshot({ template: { cardMappings: duplicated } }))).toBeNull();
  });

  it("rejects a snapshot where two active card mappings reference the same emotion", () => {
    const template = validTemplate();
    const duplicated = template.cardMappings.map((mapping, index) =>
      index === 1 ? { ...mapping, emotionCode: template.cardMappings[0]!.emotionCode } : mapping,
    );
    expect(parseActiveDiagnosis(rawSnapshot({ template: { cardMappings: duplicated } }))).toBeNull();
  });

  it("rejects a snapshot when a card mapping points at a card asset version absent from the cards array", () => {
    const cards = validCards().slice(0, 7);
    expect(parseActiveDiagnosis(rawSnapshot({ cards }))).toBeNull();
  });

  it("sorts questions and cards by their configured display order regardless of input order", () => {
    const template = validTemplate();
    const reorderedQuestions = [...template.questions].reverse();
    const reorderedMappings = [...template.cardMappings].reverse();
    const diagnosis = parseActiveDiagnosis(
      rawSnapshot({ template: { questions: reorderedQuestions, cardMappings: reorderedMappings } }),
    );
    expect(diagnosis?.questions.map((question) => question.axisCode)).toEqual(["axis_1", "axis_2", "axis_3", "axis_4"]);
    expect(diagnosis?.cards.map((card) => card.emotionCode)).toEqual([
      "emotion_1",
      "emotion_2",
      "emotion_3",
      "emotion_4",
      "emotion_5",
      "emotion_6",
      "emotion_7",
      "emotion_8",
    ]);
  });
});

describe("GetDiagnosis / access guards", () => {
  it("returns the participant view when the diagnosis is enabled and within its access window", async () => {
    const useCase = new GetDiagnosis(repository());
    const result = await useCase.execute(scope, now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.diagnosis.questions).toHaveLength(4);
    expect(result.data.diagnosis.cards).toHaveLength(8);
    expect(result.data.session).toBeNull();
    expect(result.data.result).toBeNull();
  });

  it("reports not configured when no configuration exists", async () => {
    const useCase = new GetDiagnosis(repository({ findConfiguration: async () => null }));
    await expect(useCase.execute(scope, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_NOT_CONFIGURED",
      status: 404,
    });
  });

  it("reports disabled when the event has diagnosis turned off", async () => {
    const useCase = new GetDiagnosis(repository({ findConfiguration: async () => configuration({ enabled: false }) }));
    await expect(useCase.execute(scope, now)).resolves.toEqual({ ok: false, code: "DIAGNOSIS_DISABLED", status: 409 });
  });

  it("reports not open before the configured access window", async () => {
    const accessOpensAt = new Date(now.getTime() + 60 * 60 * 1000);
    const useCase = new GetDiagnosis(repository({ findConfiguration: async () => configuration({ accessOpensAt }) }));
    await expect(useCase.execute(scope, now)).resolves.toEqual({ ok: false, code: "DIAGNOSIS_NOT_OPEN", status: 409 });
  });

  it("reports closed after the configured access window", async () => {
    const accessClosesAt = new Date(now.getTime() - 60 * 60 * 1000);
    const useCase = new GetDiagnosis(repository({ findConfiguration: async () => configuration({ accessClosesAt }) }));
    await expect(useCase.execute(scope, now)).resolves.toEqual({ ok: false, code: "DIAGNOSIS_CLOSED", status: 409 });
  });

  it("reports the snapshot as invalid when it fails the publish-time validation rules", async () => {
    const invalidSnapshot = rawSnapshot({ template: { questions: validTemplate().questions.slice(0, 3) } });
    const useCase = new GetDiagnosis(
      repository({ findConfiguration: async () => configuration({ snapshot: invalidSnapshot }) }),
    );
    await expect(useCase.execute(scope, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_SNAPSHOT_INVALID",
      status: 409,
    });
  });

  it("treats a corrupted stored result as absent rather than trusting unvalidated data", async () => {
    const useCase = new GetDiagnosis(
      repository({
        findSession: async () => session({ status: "submitted" }),
        findLatestResult: async () => ({
          id: "result-1",
          submittedRevision: 0,
          algorithmVersion: "concierge-rule-v1",
          primaryEmotionCode: "emotion_1",
          resultSnapshot: { not: "valid" },
          createdAt: now,
        }),
      }),
    );
    const result = await useCase.execute(scope, now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.result).toBeNull();
  });

  it("returns a validated stored result when it matches the result schema", async () => {
    const diagnosis = parseActiveDiagnosis(rawSnapshot())!;
    const validResult = createDeterministicDiagnosisResult({
      diagnosis,
      snapshotHash: configuration().snapshotHash,
      selectedCardAssetVersionId: cardId(1),
      answers,
    });
    const useCase = new GetDiagnosis(
      repository({
        findSession: async () => session({ status: "submitted" }),
        findLatestResult: async () => ({
          id: "result-1",
          submittedRevision: 0,
          algorithmVersion: "concierge-rule-v1",
          primaryEmotionCode: "emotion_1",
          resultSnapshot: validResult,
          createdAt: now,
        }),
      }),
    );
    const result = await useCase.execute(scope, now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.result).toEqual(validResult);
  });
});

describe("SaveDiagnosisDraft", () => {
  it("rejects a card selection that is not part of the active snapshot", async () => {
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => session() }));
    await expect(
      useCase.execute(scope, { expectedRevision: 0, selectedCardAssetVersionId: "not-a-real-card", answers }, now),
    ).resolves.toEqual({ ok: false, code: "DIAGNOSIS_INVALID_ANSWER", status: 400 });
  });

  it("rejects duplicate answers for the same analysis axis", async () => {
    const duplicateAnswers: DiagnosisAnswer[] = [
      { axisCode: "axis_1", optionCode: "opt_a" },
      { axisCode: "axis_1", optionCode: "opt_b" },
    ];
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => session() }));
    await expect(
      useCase.execute(
        scope,
        { expectedRevision: 0, selectedCardAssetVersionId: cardId(1), answers: duplicateAnswers },
        now,
      ),
    ).resolves.toEqual({ ok: false, code: "DIAGNOSIS_INVALID_ANSWER", status: 400 });
  });

  it("rejects an answer option that does not belong to its axis's question", async () => {
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => session() }));
    await expect(
      useCase.execute(
        scope,
        {
          expectedRevision: 0,
          selectedCardAssetVersionId: cardId(1),
          answers: [{ axisCode: "axis_1", optionCode: "not_an_option" }],
        },
        now,
      ),
    ).resolves.toEqual({ ok: false, code: "DIAGNOSIS_INVALID_ANSWER", status: 400 });
  });

  it("requires a started session before saving a draft", async () => {
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => null }));
    await expect(
      useCase.execute(scope, { expectedRevision: 0, selectedCardAssetVersionId: cardId(1), answers }, now),
    ).resolves.toEqual({ ok: false, code: "DIAGNOSIS_NOT_STARTED", status: 409 });
  });

  it("refuses to overwrite an already-submitted session", async () => {
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => session({ status: "submitted" }) }));
    await expect(
      useCase.execute(scope, { expectedRevision: 0, selectedCardAssetVersionId: cardId(1), answers }, now),
    ).resolves.toEqual({ ok: false, code: "DIAGNOSIS_ALREADY_SUBMITTED", status: 409 });
  });

  it("surfaces a revision conflict when the stored revision no longer matches", async () => {
    const saveDraft = vi.fn(async () => null);
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => session(), saveDraft }));
    const input = { expectedRevision: 5, selectedCardAssetVersionId: cardId(1), answers };
    await expect(useCase.execute(scope, input, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_REVISION_CONFLICT",
      status: 409,
    });
    expect(saveDraft).toHaveBeenCalledWith(scope, "session-1", input, now);
  });

  it("saves a valid draft and returns the new revision", async () => {
    const saveDraft = vi.fn(async () => session({ revision: 1 }));
    const useCase = new SaveDiagnosisDraft(repository({ findSession: async () => session(), saveDraft }));
    await expect(
      useCase.execute(scope, { expectedRevision: 0, selectedCardAssetVersionId: cardId(1), answers }, now),
    ).resolves.toEqual({ ok: true, data: { revision: 1 } });
  });
});

describe("SubmitDiagnosis", () => {
  it("rejects submission when no card has been selected", async () => {
    const useCase = new SubmitDiagnosis(
      repository({
        findSession: async () => session({ selectedCardAssetVersionId: null }),
        listAnswers: async () => answers,
      }),
    );
    await expect(useCase.execute(scope, { expectedRevision: 0 }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_INCOMPLETE",
      status: 409,
    });
  });

  it("rejects submission when fewer than four questions are answered", async () => {
    const useCase = new SubmitDiagnosis(
      repository({
        findSession: async () => session({ selectedCardAssetVersionId: cardId(1) }),
        listAnswers: async () => answers.slice(0, 3),
      }),
    );
    await expect(useCase.execute(scope, { expectedRevision: 0 }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_INCOMPLETE",
      status: 409,
    });
  });

  it("requires a started session before submitting", async () => {
    const useCase = new SubmitDiagnosis(repository({ findSession: async () => null }));
    await expect(useCase.execute(scope, { expectedRevision: 0 }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_NOT_STARTED",
      status: 409,
    });
  });

  it("refuses to resubmit an already-submitted session", async () => {
    const useCase = new SubmitDiagnosis(repository({ findSession: async () => session({ status: "submitted" }) }));
    await expect(useCase.execute(scope, { expectedRevision: 0 }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_ALREADY_SUBMITTED",
      status: 409,
    });
  });

  it("surfaces a revision conflict when the session moved on before submit", async () => {
    const submit = vi.fn(async () => null);
    const useCase = new SubmitDiagnosis(
      repository({
        findSession: async () => session({ selectedCardAssetVersionId: cardId(1) }),
        listAnswers: async () => answers,
        submit,
      }),
    );
    await expect(useCase.execute(scope, { expectedRevision: 2 }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_REVISION_CONFLICT",
      status: 409,
    });
  });

  it("produces the same deterministic rule-based result for identical snapshot, card, and answers", async () => {
    const submit = vi.fn(async () => session({ status: "submitted", submittedAt: now }));
    const buildUseCase = () =>
      new SubmitDiagnosis(
        repository({
          findSession: async () => session({ selectedCardAssetVersionId: cardId(1) }),
          listAnswers: async () => answers,
          submit,
        }),
      );

    const first = await buildUseCase().execute(scope, { expectedRevision: 0 }, now);
    const second = await buildUseCase().execute(scope, { expectedRevision: 0 }, now);

    expect(first).toEqual(second);
    if (!first.ok) throw new Error("expected success");
    expect(first.data.result).toMatchObject({
      algorithmVersion: "concierge-rule-v1",
      primaryEmotion: { code: "emotion_1" },
      card: { assetVersionId: cardId(1) },
    });
    expect(first.data.result.axes).toHaveLength(4);
  });
});

describe("StartDiagnosis", () => {
  it("creates a new session when the participant has not started yet", async () => {
    const createSession = vi.fn(async () => session());
    const useCase = new StartDiagnosis(repository({ findSession: async () => null, createSession }));
    await expect(useCase.execute(scope, {}, now)).resolves.toEqual({ ok: true, data: { session: session() } });
    expect(createSession).toHaveBeenCalledWith(scope, "config-1", now);
  });

  it("returns the existing in-progress session without creating a new one", async () => {
    const createSession = vi.fn(async () => session());
    const existing = session({ id: "session-existing" });
    const useCase = new StartDiagnosis(repository({ findSession: async () => existing, createSession }));
    await expect(useCase.execute(scope, {}, now)).resolves.toEqual({ ok: true, data: { session: existing } });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses to restart a submitted session when resubmission is not requested", async () => {
    const useCase = new StartDiagnosis(
      repository({
        findSession: async () => session({ status: "submitted" }),
        findConfiguration: async () => configuration({ allowResubmission: true }),
      }),
    );
    await expect(useCase.execute(scope, { restart: false }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_ALREADY_SUBMITTED",
      status: 409,
    });
  });

  it("refuses to restart a submitted session when the event disallows resubmission", async () => {
    const useCase = new StartDiagnosis(
      repository({
        findSession: async () => session({ status: "submitted" }),
        findConfiguration: async () => configuration({ allowResubmission: false }),
      }),
    );
    await expect(useCase.execute(scope, { restart: true }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_ALREADY_SUBMITTED",
      status: 409,
    });
  });

  it("reopens a submitted session for re-answering when resubmission is allowed and requested", async () => {
    const reopened = session({
      status: "in_progress",
      revision: 3,
      selectedCardAssetVersionId: null,
      submittedAt: null,
    });
    const reopenSession = vi.fn(async () => reopened);
    const useCase = new StartDiagnosis(
      repository({
        findSession: async () => session({ status: "submitted" }),
        findConfiguration: async () => configuration({ allowResubmission: true }),
        reopenSession,
      }),
    );
    await expect(useCase.execute(scope, { restart: true }, now)).resolves.toEqual({
      ok: true,
      data: { session: reopened },
    });
    expect(reopenSession).toHaveBeenCalledWith(scope, "session-1", now);
  });

  it("surfaces a revision conflict when reopening races another update", async () => {
    const useCase = new StartDiagnosis(
      repository({
        findSession: async () => session({ status: "submitted" }),
        findConfiguration: async () => configuration({ allowResubmission: true }),
        reopenSession: async () => null,
      }),
    );
    await expect(useCase.execute(scope, { restart: true }, now)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_REVISION_CONFLICT",
      status: 409,
    });
  });
});

describe("UpdateDiagnosisEventSettings", () => {
  const settingsInput = {
    tenantId: scope.tenantId,
    eventId: scope.eventId,
    actorUserId: "staff-1",
    requestId: "request-1",
    enabled: true,
    accessOpensAt: now,
    accessClosesAt: new Date(now.getTime() + 60 * 60 * 1000),
    allowResubmission: true,
    now,
  };

  it("rejects an access window where opening is not before closing", async () => {
    const useCase = new UpdateDiagnosisEventSettings(repository());
    await expect(
      useCase.execute({
        ...settingsInput,
        accessOpensAt: settingsInput.accessClosesAt,
        accessClosesAt: settingsInput.accessOpensAt,
      }),
    ).resolves.toEqual({ ok: false, code: "DIAGNOSIS_INVALID_SETTINGS", status: 400 });
  });

  it("saves valid settings through the repository", async () => {
    const updateEventSettings = vi.fn(async () => configuration());
    const useCase = new UpdateDiagnosisEventSettings(repository({ updateEventSettings }));
    await expect(useCase.execute(settingsInput)).resolves.toEqual({ ok: true, data: configuration() });
    expect(updateEventSettings).toHaveBeenCalledWith(settingsInput);
  });

  it("surfaces a conflict when the repository cannot apply the settings", async () => {
    const useCase = new UpdateDiagnosisEventSettings(repository({ updateEventSettings: async () => null }));
    await expect(useCase.execute(settingsInput)).resolves.toEqual({
      ok: false,
      code: "DIAGNOSIS_SNAPSHOT_INVALID",
      status: 409,
    });
  });
});

describe("createDeterministicDiagnosisResult", () => {
  const diagnosis = parseActiveDiagnosis(rawSnapshot())!;

  it("returns null when the selected card is not part of the diagnosis", () => {
    expect(
      createDeterministicDiagnosisResult({
        diagnosis,
        snapshotHash: "hash",
        selectedCardAssetVersionId: "missing",
        answers,
      }),
    ).toBeNull();
  });

  it("returns null when an answer is missing for one of the four axes", () => {
    expect(
      createDeterministicDiagnosisResult({
        diagnosis,
        snapshotHash: "hash",
        selectedCardAssetVersionId: cardId(1),
        answers: answers.slice(0, 3),
      }),
    ).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    const first = createDeterministicDiagnosisResult({
      diagnosis,
      snapshotHash: "hash",
      selectedCardAssetVersionId: cardId(1),
      answers,
    });
    const second = createDeterministicDiagnosisResult({
      diagnosis,
      snapshotHash: "hash",
      selectedCardAssetVersionId: cardId(1),
      answers,
    });
    expect(first).toEqual(second);
    expect(first?.primaryEmotion.code).toBe("emotion_1");
  });

  it("maps a different selected card to its own mapped emotion", () => {
    const result = createDeterministicDiagnosisResult({
      diagnosis,
      snapshotHash: "hash",
      selectedCardAssetVersionId: cardId(3),
      answers,
    });
    expect(result?.primaryEmotion.code).toBe("emotion_3");
    expect(result?.card.assetVersionId).toBe(cardId(3));
  });
});
