import { z } from "zod";

export const matchChatConfigSchema = z
  .object({
    enabled: z.boolean(),
    windowHours: z.number().int().min(1).max(168),
    messagesPerMinute: z.number().int().min(1).max(60),
    maxMessageLength: z.number().int().min(1).max(2000),
    termsVersion: z.string().trim().min(1).max(80).nullable(),
    termsBody: z.string().trim().min(1).max(50_000).nullable(),
    retentionDays: z.number().int().min(1).max(3650).nullable(),
    reportOwnerLabel: z.string().trim().min(1).max(120).nullable(),
    uatConfirmed: z.boolean(),
  })
  .superRefine((value, context) => {
    if (
      value.enabled &&
      (!value.termsVersion ||
        !value.termsBody ||
        value.retentionDays === null ||
        !value.reportOwnerLabel ||
        !value.uatConfirmed)
    ) {
      context.addIssue({
        code: "custom",
        message: "Enabled chat requires terms, retention, report owner, and completed UAT",
      });
    }
  });

export const matchChatReportSchema = z.object({
  category: z.enum(["harassment", "spam", "inappropriate", "safety_concern", "other"]),
  detail: z.string().trim().max(1000).nullable(),
});

export const sendMatchChatMessageSchema = z.object({
  clientMessageId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export type MatchChatConfig = z.infer<typeof matchChatConfigSchema>;
export type MatchChatReportInput = z.infer<typeof matchChatReportSchema>;
export type SendMatchChatMessageInput = z.infer<typeof sendMatchChatMessageSchema>;

export const matchChatReportStatusSchema = z.enum(["open", "reviewing", "resolved"]);
export const updateMatchChatReportSchema = z.object({
  status: z.enum(["reviewing", "resolved"]),
});

export type MatchChatAdminScope = {
  tenantId: string;
  eventId: string;
  serviceType: string;
  actorUserId: string;
  requestId: string;
};

export type MatchChatAdminReport = {
  id: string;
  roomId: string;
  reporterParticipantNumber: string | null;
  reportedParticipantNumber: string | null;
  category: MatchChatReportInput["category"];
  detail: string | null;
  status: z.infer<typeof matchChatReportStatusSchema>;
  createdAt: string;
  resolvedAt: string | null;
};

export type MatchChatAdminWorkspace = {
  eventName: string;
  config: MatchChatConfig;
  reports: MatchChatAdminReport[];
};

export type MatchChatScope = {
  tenantId: string;
  eventId: string;
  serviceType: string;
  participantId: string;
};

export type MatchChatRoom = {
  id: string;
  matchCandidateId: string;
  participantAId: string;
  participantBId: string;
  status: "pending_consent" | "open" | "blocked" | "closed";
  opensAt: Date | null;
  closesAt: Date;
};

export type MatchChatEligibility = {
  matchCandidateId: string;
  participantAId: string;
  participantBId: string;
  resultPublishedAt: Date;
  resultConfirmationActive: boolean;
};

export type MatchChatAccessContext = {
  config: MatchChatConfig;
  room: MatchChatRoom;
  eligibilityActive: boolean;
};

export type MatchChatRoomSetup = {
  room: MatchChatRoom;
  termsVersion: string;
  termsBody: string;
  maxMessageLength: number;
  participantConsented: boolean;
};

export type EncryptedMatchChatMessage = {
  id: string;
  senderParticipantId: string;
  clientMessageId: string;
  encryptedBody: string;
  encryptionVersion: string;
  sentAt: Date;
  expiresAt: Date;
};

export type MatchChatMessage = {
  id: string;
  sender: "self" | "match";
  body: string;
  sentAt: string;
};

export type MatchChatCipherContext = {
  tenantId: string;
  eventId: string;
  roomId: string;
  senderParticipantId: string;
  clientMessageId: string;
};

export interface MatchChatMessageCipher {
  encrypt(body: string, context: MatchChatCipherContext): Promise<{ ciphertext: string; version: string }>;
  decrypt(ciphertext: string, version: string, context: MatchChatCipherContext): Promise<string>;
}

export type SaveEncryptedMessageResult =
  | { status: "saved" | "idempotent"; message: EncryptedMatchChatMessage }
  | { status: "rate_limited" }
  | { status: "not_available" };

export type MatchChatResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "MATCH_CHAT_DISABLED"
        | "MATCH_CHAT_NOT_AVAILABLE"
        | "MATCH_CHAT_EXPIRED"
        | "MATCH_CHAT_BLOCKED"
        | "MATCH_CHAT_TERMS_CHANGED"
        | "MATCH_CHAT_INVALID_REPORT"
        | "MATCH_CHAT_INVALID_MESSAGE"
        | "MATCH_CHAT_INVALID_REQUEST"
        | "MATCH_CHAT_CONSENT_REQUIRED"
        | "MATCH_CHAT_RATE_LIMITED"
        | "MATCH_CHAT_UNAVAILABLE";
      status: 400 | 403 | 404 | 409 | 429 | 503;
    };
