import type {
  EncryptedMatchChatMessage,
  MatchChatAccessContext,
  MatchChatConfig,
  MatchChatEligibility,
  MatchChatReportInput,
  MatchChatRoom,
  MatchChatScope,
  SaveEncryptedMessageResult,
} from "./types";

export interface MatchChatSafetyRepository {
  findConfig(scope: MatchChatScope): Promise<MatchChatConfig | null>;
  findEligibility(scope: MatchChatScope, matchCandidateId: string): Promise<MatchChatEligibility | null>;
  findRoom(scope: MatchChatScope, matchCandidateId: string): Promise<MatchChatRoom | null>;
  createRoom(
    scope: MatchChatScope,
    eligibility: MatchChatEligibility,
    closesAt: Date,
    now: Date,
  ): Promise<MatchChatRoom>;
  findAccessContext(scope: MatchChatScope, roomId: string): Promise<MatchChatAccessContext | null>;
  acceptConsent(scope: MatchChatScope, roomId: string, termsVersion: string, now: Date): Promise<void>;
  listActiveConsentParticipantIds(scope: MatchChatScope, roomId: string): Promise<string[]>;
  openRoom(scope: MatchChatScope, roomId: string, now: Date): Promise<MatchChatRoom>;
  blockRoom(scope: MatchChatScope, roomId: string, blockedParticipantId: string, now: Date): Promise<void>;
  createReport(
    scope: MatchChatScope,
    roomId: string,
    reportedParticipantId: string,
    input: MatchChatReportInput,
    now: Date,
  ): Promise<void>;
  saveEncryptedMessage(
    scope: MatchChatScope,
    roomId: string,
    input: {
      clientMessageId: string;
      encryptedBody: string;
      encryptionVersion: string;
      sentAt: Date;
      expiresAt: Date;
      messagesPerMinute: number;
    },
  ): Promise<SaveEncryptedMessageResult>;
  listEncryptedMessages(
    scope: MatchChatScope,
    roomId: string,
    now: Date,
    limit: number,
  ): Promise<EncryptedMatchChatMessage[]>;
}
