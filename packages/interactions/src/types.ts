import { z } from "zod";

export const interactionServiceTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_-]+$/);
export const interactionFeelingCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_-]+$/);
export const interactionTargetSourceSchema = z.enum(["interaction_slot", "self_reported", "operator_import"]);
export const interactionPublicProfileFieldKeySchema = z.enum([
  "nickname",
  "age_or_band",
  "residence_municipality",
  "occupation",
  "hobbies",
  "holiday_style",
  "support_wanted",
  "support_offered",
  "public_dream",
]);
export const interactionPublicProfileFieldKeysSchema = z
  .array(interactionPublicProfileFieldKeySchema)
  .max(interactionPublicProfileFieldKeySchema.options.length)
  .refine((keys) => new Set(keys).size === keys.length, "公開プロフィール項目が重複しています");
export type InteractionPublicProfileFieldKey = z.infer<typeof interactionPublicProfileFieldKeySchema>;

export type InteractionMemoScope = {
  tenantId: string;
  eventId: string;
  serviceType: string;
  participantId: string;
};

export type InteractionMemoAuditScope = InteractionMemoScope & {
  actorUserId: string;
  requestId: string;
};

export type InteractionMemoSnapshot = {
  id: string;
  version: number;
  targetSource: "interaction_slot" | "self_reported" | "operator_import";
  publicProfileFieldKeys: InteractionPublicProfileFieldKey[];
  editableUntil: Date | null;
};

export type InteractionMemoOption = {
  code: string;
  label: string;
  displayOrder: number;
  isNegative: boolean;
};

export type InteractionMemoTarget = {
  interactionSlotId: string;
  targetParticipantId: string;
  participantNumber: string | null;
  roundNo: number | null;
};

export type InteractionMemoTargetCandidate = {
  targetParticipantId: string;
  participantNumber: string;
};

export type InteractionPreferenceHints = {
  targetParticipantIds: string[];
  wantsToTalkMoreTargetIds: string[];
};

export type InteractionPublicProfileSource = {
  participantNumber: string;
  nickname: string | null;
  birthDate: string;
  residenceArea: string | null;
  additionalAnswers: Record<string, string>;
  publicDream: string | null;
};

export type InteractionPublicProfileField = {
  key: InteractionPublicProfileFieldKey;
  label: string;
  value: string;
};

export type InteractionPublicProfile = {
  participantNumber: string;
  fields: InteractionPublicProfileField[];
};

export type InteractionMemoNote = {
  id: string;
  interactionSlotId: string;
  targetParticipantId: string;
  feelingCode: string;
  favorite: boolean;
  privateNoteText?: string;
  wantsToTalkMore?: boolean;
  revision: number;
  savedAt: Date;
};

export type InteractionMemoWorkspace = {
  enabled: boolean;
  snapshotVersion?: number;
  targetSource?: InteractionMemoSnapshot["targetSource"];
  editableUntil?: string | null;
  options: InteractionMemoOption[];
  targets: Array<InteractionMemoTarget & { note: InteractionMemoNote | null }>;
};

export type SaveInteractionMemoInput = {
  interactionSlotId: string;
  targetParticipantId: string;
  feelingCode: string;
  favorite: boolean;
  privateNoteText?: string;
  wantsToTalkMore?: boolean;
  expectedRevision: number;
};

export type InteractionMemoResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "INTERACTION_MEMO_DISABLED"
        | "INTERACTION_MEMO_NOT_OPEN"
        | "INTERACTION_TARGET_NOT_ALLOWED"
        | "INVALID_FEELING_CODE"
        | "PARTICIPATION_NOT_CONFIRMED"
        | "REVISION_CONFLICT"
        | "INTERACTION_TARGET_QUERY_INVALID"
        | "INTERACTION_TARGET_HAS_NOTE";
      status: 400 | 404 | 409;
    };
