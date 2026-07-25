import { z } from "zod";

import type { ActiveDiagnosis } from "./snapshot";

export type DiagnosisScope = {
  tenantId: string;
  eventId: string;
  participantId: string;
  userId: string;
};

export type DiagnosisConfiguration = {
  id: string;
  snapshotHash: string;
  snapshot: unknown;
  enabled: boolean;
  accessOpensAt: Date | null;
  accessClosesAt: Date | null;
  allowResubmission: boolean;
};

export type DiagnosisSession = {
  id: string;
  snapshotId: string;
  status: "in_progress" | "submitted";
  revision: number;
  selectedCardAssetVersionId: string | null;
  startedAt: Date;
  submittedAt: Date | null;
};

export type DiagnosisAnswer = {
  axisCode: string;
  optionCode: string;
};

export const diagnosisResultSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  algorithmVersion: z.literal("concierge-rule-v1"),
  snapshotHash: z.string().length(64),
  primaryEmotion: z.object({
    code: z.string().min(1),
    label: z.string().min(1),
    description: z.string(),
  }),
  card: z.object({
    assetVersionId: z.string().uuid(),
    title: z.string().min(1),
    message: z.string(),
  }),
  axes: z
    .array(
      z.object({
        axisCode: z.string().min(1),
        prompt: z.string().min(1),
        optionCode: z.string().min(1),
        optionLabel: z.string().min(1),
      }),
    )
    .length(4),
});

export type DiagnosisResultSnapshot = z.infer<typeof diagnosisResultSnapshotSchema>;

export type DiagnosisStoredResult = {
  id: string;
  submittedRevision: number;
  algorithmVersion: string;
  primaryEmotionCode: string;
  resultSnapshot: unknown;
  createdAt: Date;
};

export type DiagnosisView = {
  diagnosis: ActiveDiagnosis;
  snapshotHash: string;
  access: {
    opensAt: Date | null;
    closesAt: Date | null;
    allowResubmission: boolean;
  };
  session: DiagnosisSession | null;
  answers: DiagnosisAnswer[];
  result: DiagnosisResultSnapshot | null;
};

export type DiagnosisSaveInput = {
  expectedRevision: number;
  selectedCardAssetVersionId: string;
  answers: DiagnosisAnswer[];
};

export type DiagnosisResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "DIAGNOSIS_NOT_CONFIGURED"
        | "DIAGNOSIS_DISABLED"
        | "DIAGNOSIS_NOT_OPEN"
        | "DIAGNOSIS_CLOSED"
        | "DIAGNOSIS_SNAPSHOT_INVALID"
        | "DIAGNOSIS_NOT_STARTED"
        | "DIAGNOSIS_ALREADY_SUBMITTED"
        | "DIAGNOSIS_REVISION_CONFLICT"
        | "DIAGNOSIS_INCOMPLETE"
        | "DIAGNOSIS_INVALID_ANSWER"
        | "DIAGNOSIS_INVALID_SETTINGS";
      status: 400 | 404 | 409;
    };
