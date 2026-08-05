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

export type InteractionMemoNote = {
  id: string;
  interactionSlotId: string;
  targetParticipantId: string;
  feelingCode: string;
  favorite: boolean;
  revision: number;
  savedAt: Date;
};

export type InteractionMemoWorkspace = {
  enabled: boolean;
  snapshotVersion?: number;
  editableUntil?: string | null;
  options: InteractionMemoOption[];
  targets: Array<InteractionMemoTarget & { note: InteractionMemoNote | null }>;
};

export type SaveInteractionMemoInput = {
  interactionSlotId: string;
  targetParticipantId: string;
  feelingCode: string;
  favorite: boolean;
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
        | "REVISION_CONFLICT";
      status: 400 | 404 | 409;
    };
