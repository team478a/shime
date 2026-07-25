import type {
  DiagnosisAnswer,
  DiagnosisConfiguration,
  DiagnosisResultSnapshot,
  DiagnosisSaveInput,
  DiagnosisScope,
  DiagnosisSession,
  DiagnosisStoredResult,
} from "./types";

export type DiagnosisEventSettings = {
  tenantId: string;
  eventId: string;
  actorUserId: string;
  requestId: string;
  enabled: boolean;
  accessOpensAt: Date | null;
  accessClosesAt: Date | null;
  allowResubmission: boolean;
  now: Date;
};

export type DiagnosisStatusSummary = {
  eligibleCount: number;
  notStartedCount: number;
  inProgressCount: number;
  submittedCount: number;
};

export interface ConciergeDiagnosisRepository {
  findConfiguration(scope: Pick<DiagnosisScope, "tenantId" | "eventId">): Promise<DiagnosisConfiguration | null>;
  findSession(scope: DiagnosisScope): Promise<DiagnosisSession | null>;
  listAnswers(scope: DiagnosisScope, sessionId: string): Promise<DiagnosisAnswer[]>;
  findLatestResult(scope: DiagnosisScope, sessionId: string): Promise<DiagnosisStoredResult | null>;
  createSession(scope: DiagnosisScope, snapshotId: string, now: Date): Promise<DiagnosisSession>;
  reopenSession(scope: DiagnosisScope, sessionId: string, now: Date): Promise<DiagnosisSession | null>;
  saveDraft(
    scope: DiagnosisScope,
    sessionId: string,
    input: DiagnosisSaveInput,
    now: Date,
  ): Promise<DiagnosisSession | null>;
  submit(
    scope: DiagnosisScope,
    sessionId: string,
    expectedRevision: number,
    result: DiagnosisResultSnapshot,
    now: Date,
  ): Promise<DiagnosisSession | null>;
  logAccess(
    scope: DiagnosisScope,
    sessionId: string | null,
    action: "view" | "start" | "save" | "submit" | "result_view" | "restart",
    now: Date,
  ): Promise<void>;
  getCardObjectKey(
    scope: Pick<DiagnosisScope, "tenantId" | "eventId">,
    cardAssetVersionId: string,
  ): Promise<string | null>;
  updateEventSettings(input: DiagnosisEventSettings): Promise<DiagnosisConfiguration | null>;
  getStatusSummary(scope: Pick<DiagnosisScope, "tenantId" | "eventId">): Promise<DiagnosisStatusSummary | null>;
}
