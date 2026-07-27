import type { ConciergeDiagnosisRepository } from "./repository";
import type { DiagnosisEventSettings } from "./repository";
import { createDeterministicDiagnosisResult } from "./rules";
import { parseActiveDiagnosis } from "./snapshot";
import { diagnosisResultSnapshotSchema } from "./types";
import type { DiagnosisAnswer, DiagnosisResult, DiagnosisSaveInput, DiagnosisScope, DiagnosisView } from "./types";

type DiagnosisFailure = Extract<DiagnosisResult<never>, { ok: false }>;

function unavailable(
  code:
    | "DIAGNOSIS_NOT_CONFIGURED"
    | "DIAGNOSIS_DISABLED"
    | "DIAGNOSIS_NOT_OPEN"
    | "DIAGNOSIS_CLOSED"
    | "DIAGNOSIS_SNAPSHOT_INVALID",
): DiagnosisFailure {
  return { ok: false, code, status: code === "DIAGNOSIS_NOT_CONFIGURED" ? 404 : 409 };
}

async function loadActiveDiagnosis(repository: ConciergeDiagnosisRepository, scope: DiagnosisScope, now: Date) {
  const configuration = await repository.findConfiguration(scope);
  if (!configuration) return unavailable("DIAGNOSIS_NOT_CONFIGURED");
  if (!configuration.enabled) return unavailable("DIAGNOSIS_DISABLED");
  if (configuration.accessOpensAt && now < configuration.accessOpensAt) return unavailable("DIAGNOSIS_NOT_OPEN");
  if (configuration.accessClosesAt && now > configuration.accessClosesAt) return unavailable("DIAGNOSIS_CLOSED");
  const diagnosis = parseActiveDiagnosis(configuration.snapshot);
  if (!diagnosis) return unavailable("DIAGNOSIS_SNAPSHOT_INVALID");
  return { ok: true as const, configuration, diagnosis };
}

function validAnswers(diagnosis: NonNullable<ReturnType<typeof parseActiveDiagnosis>>, answers: DiagnosisAnswer[]) {
  if (new Set(answers.map((answer) => answer.axisCode)).size !== answers.length) return false;
  return answers.every((answer) => {
    const question = diagnosis.questions.find((candidate) => candidate.axisCode === answer.axisCode);
    return question?.options.some((option) => option.code === answer.optionCode) ?? false;
  });
}

export class GetDiagnosis {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  async execute(scope: DiagnosisScope, now = new Date()): Promise<DiagnosisResult<DiagnosisView>> {
    const loaded = await loadActiveDiagnosis(this.repository, scope, now);
    if (!loaded.ok) return loaded;
    const session = await this.repository.findSession(scope);
    const answers = session ? await this.repository.listAnswers(scope, session.id) : [];
    const storedResult = session ? await this.repository.findLatestResult(scope, session.id) : null;
    const parsedResult = diagnosisResultSnapshotSchema.safeParse(storedResult?.resultSnapshot);
    const result = parsedResult.success ? parsedResult.data : null;
    await this.repository.logAccess(scope, session?.id ?? null, result ? "result_view" : "view", now);
    return {
      ok: true,
      data: {
        diagnosis: loaded.diagnosis,
        snapshotHash: loaded.configuration.snapshotHash,
        access: {
          opensAt: loaded.configuration.accessOpensAt,
          closesAt: loaded.configuration.accessClosesAt,
          allowResubmission: loaded.configuration.allowResubmission,
        },
        session,
        answers,
        result,
      },
    };
  }
}

export class StartDiagnosis {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  async execute(
    scope: DiagnosisScope,
    input: { restart?: boolean | undefined },
    now = new Date(),
  ): Promise<DiagnosisResult<{ session: Awaited<ReturnType<ConciergeDiagnosisRepository["findSession"]>> }>> {
    const loaded = await loadActiveDiagnosis(this.repository, scope, now);
    if (!loaded.ok) return loaded;
    const existing = await this.repository.findSession(scope);
    if (existing?.status === "submitted") {
      if (!input.restart || !loaded.configuration.allowResubmission) {
        return { ok: false, code: "DIAGNOSIS_ALREADY_SUBMITTED", status: 409 };
      }
      const reopened = await this.repository.reopenSession(scope, existing.id, now);
      if (!reopened) return { ok: false, code: "DIAGNOSIS_REVISION_CONFLICT", status: 409 };
      await this.repository.logAccess(scope, reopened.id, "restart", now);
      return { ok: true, data: { session: reopened } };
    }
    const session = existing ?? (await this.repository.createSession(scope, loaded.configuration.id, now));
    await this.repository.logAccess(scope, session.id, "start", now);
    return { ok: true, data: { session } };
  }
}

export class SaveDiagnosisDraft {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  async execute(
    scope: DiagnosisScope,
    input: DiagnosisSaveInput,
    now = new Date(),
  ): Promise<DiagnosisResult<{ revision: number }>> {
    const loaded = await loadActiveDiagnosis(this.repository, scope, now);
    if (!loaded.ok) return loaded;
    const session = await this.repository.findSession(scope);
    if (!session) return { ok: false, code: "DIAGNOSIS_NOT_STARTED", status: 409 };
    if (session.status === "submitted") return { ok: false, code: "DIAGNOSIS_ALREADY_SUBMITTED", status: 409 };
    if (
      !loaded.diagnosis.cards.some((card) => card.id === input.selectedCardAssetVersionId) ||
      !validAnswers(loaded.diagnosis, input.answers)
    ) {
      return { ok: false, code: "DIAGNOSIS_INVALID_ANSWER", status: 400 };
    }
    const saved = await this.repository.saveDraft(scope, session.id, input, now);
    if (!saved) return { ok: false, code: "DIAGNOSIS_REVISION_CONFLICT", status: 409 };
    await this.repository.logAccess(scope, session.id, "save", now);
    return { ok: true, data: { revision: saved.revision } };
  }
}

export class SubmitDiagnosis {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  async execute(
    scope: DiagnosisScope,
    input: { expectedRevision: number },
    now = new Date(),
  ): Promise<DiagnosisResult<{ result: NonNullable<DiagnosisView["result"]> }>> {
    const loaded = await loadActiveDiagnosis(this.repository, scope, now);
    if (!loaded.ok) return loaded;
    const session = await this.repository.findSession(scope);
    if (!session) return { ok: false, code: "DIAGNOSIS_NOT_STARTED", status: 409 };
    if (session.status === "submitted") return { ok: false, code: "DIAGNOSIS_ALREADY_SUBMITTED", status: 409 };
    const answers = await this.repository.listAnswers(scope, session.id);
    const result = session.selectedCardAssetVersionId
      ? createDeterministicDiagnosisResult({
          diagnosis: loaded.diagnosis,
          snapshotHash: loaded.configuration.snapshotHash,
          selectedCardAssetVersionId: session.selectedCardAssetVersionId,
          answers,
        })
      : null;
    if (!result) return { ok: false, code: "DIAGNOSIS_INCOMPLETE", status: 409 };
    const submitted = await this.repository.submit(scope, session.id, input.expectedRevision, result, now);
    if (!submitted) return { ok: false, code: "DIAGNOSIS_REVISION_CONFLICT", status: 409 };
    await this.repository.logAccess(scope, session.id, "submit", now);
    return { ok: true, data: { result } };
  }
}

export class UpdateDiagnosisEventSettings {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  async execute(
    input: DiagnosisEventSettings,
  ): Promise<DiagnosisResult<NonNullable<Awaited<ReturnType<ConciergeDiagnosisRepository["updateEventSettings"]>>>>> {
    if (input.accessOpensAt && input.accessClosesAt && input.accessOpensAt >= input.accessClosesAt) {
      return { ok: false, code: "DIAGNOSIS_INVALID_SETTINGS", status: 400 };
    }
    const configuration = await this.repository.updateEventSettings(input);
    return configuration
      ? { ok: true, data: configuration }
      : { ok: false, code: "DIAGNOSIS_SNAPSHOT_INVALID", status: 409 };
  }
}

export class GetDiagnosisStatusSummary {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  execute(scope: { tenantId: string; eventId: string }) {
    return this.repository.getStatusSummary(scope);
  }
}

export class GetDiagnosisCardObjectKey {
  constructor(private readonly repository: ConciergeDiagnosisRepository) {}

  async execute(scope: DiagnosisScope, cardAssetVersionId: string, now = new Date()) {
    const loaded = await loadActiveDiagnosis(this.repository, scope, now);
    if (!loaded.ok) return null;
    const session = await this.repository.findSession(scope);
    if (session?.selectedCardAssetVersionId !== cardAssetVersionId) return null;
    return loaded.diagnosis.cards.find((card) => card.id === cardAssetVersionId)?.storageObjectKey ?? null;
  }
}
