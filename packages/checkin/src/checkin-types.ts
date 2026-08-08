import { z } from "zod";

export const receptionEventSettingsSchema = z
  .object({
    participantCategories: z
      .array(
        z.object({
          code: z.string().min(1).max(80),
          label: z.string().min(1).max(80),
        }),
      )
      .default([]),
  })
  .passthrough();

export const participantNumberEventSettingsSchema = z
  .object({
    participantNumberAssignmentMode: z.enum(["automatic", "manual"]).default("automatic"),
    participantNumber: z.object({
      groupAPrefix: z.string().min(1).max(8),
      groupBPrefix: z.string().min(1).max(8),
      digits: z.number().int().min(2).max(8),
    }),
  })
  .passthrough();

export type CheckinMethod = "qr" | "manual";

export type ConfirmCheckinInput = {
  tenantId: string;
  eventId: string;
  participantId: string;
  actorUserId: string;
  method: CheckinMethod;
  requestId: string;
  now: Date;
};

export type ConfirmedCheckin = {
  id: string;
  tenantId: string;
  eventId: string;
  participantId: string;
  status: "checked_in" | "cancelled";
  checkedInAt: Date | null;
  checkedInBy: string | null;
  method: CheckinMethod;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  receptionCategory: string | null;
  receptionCategoryLabel: string | null;
  receptionNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ConfirmCheckinRepositoryResult =
  | { outcome: "not_found" }
  | { outcome: "already_checked_in"; checkedInAt: Date | null }
  | { outcome: "confirmed"; checkin: ConfirmedCheckin };

export type ConfirmCheckinResult =
  | { ok: true; data: ConfirmedCheckin }
  | {
      ok: false;
      code: "NOT_FOUND";
      status: 404;
    }
  | {
      ok: false;
      code: "ALREADY_CHECKED_IN";
      status: 409;
      data: { checkedInAt: Date | null };
    };

export type AssignParticipantNumberInput = {
  tenantId: string;
  eventId: string;
  participantId: string;
  participantNumber: string;
  actorUserId: string;
  requestId: string;
  now: Date;
};

export type AssignParticipantNumberRepositoryResult =
  | {
      outcome: "assigned";
      participantNumber: string;
      swappedParticipantId?: string;
      swappedParticipantNumber?: string;
    }
  | { outcome: "not_found" }
  | { outcome: "automatic_mode" }
  | { outcome: "invalid_format" }
  | { outcome: "duplicate" };

export type AssignParticipantNumberResult =
  | {
      ok: true;
      data: {
        participantNumber: string;
        swappedParticipantId?: string;
        swappedParticipantNumber?: string;
      };
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "MANUAL_NUMBERING_DISABLED" | "INVALID_PARTICIPANT_NUMBER";
      status: 404 | 409 | 422;
    }
  | { ok: false; code: "PARTICIPANT_NUMBER_DUPLICATE"; status: 409 };
