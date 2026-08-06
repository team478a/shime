import { z } from "zod";

export const matchChatConfigSchema = z
  .object({
    enabled: z.boolean(),
    windowHours: z.number().int().min(1).max(168),
    messagesPerMinute: z.number().int().min(1).max(60),
    maxMessageLength: z.number().int().min(1).max(2000),
    termsVersion: z.string().trim().min(1).max(80).nullable(),
    retentionDays: z.number().int().min(1).max(3650).nullable(),
  })
  .superRefine((value, context) => {
    if (value.enabled && (!value.termsVersion || value.retentionDays === null)) {
      context.addIssue({ code: "custom", message: "Enabled chat requires termsVersion and retentionDays" });
    }
  });

export const matchChatReportSchema = z.object({
  category: z.enum(["harassment", "spam", "inappropriate", "safety_concern", "other"]),
  detail: z.string().trim().max(1000).nullable(),
});

export type MatchChatConfig = z.infer<typeof matchChatConfigSchema>;
export type MatchChatReportInput = z.infer<typeof matchChatReportSchema>;

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
        | "MATCH_CHAT_INVALID_REPORT";
      status: 400 | 403 | 404 | 409;
    };
