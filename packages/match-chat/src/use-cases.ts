import type { MatchChatSafetyRepository } from "./repository";
import {
  type MatchChatAccessContext,
  matchChatConfigSchema,
  type MatchChatMessage,
  type MatchChatMessageCipher,
  matchChatReportSchema,
  type MatchChatResult,
  type MatchChatRoom,
  type MatchChatRoomSetup,
  type MatchChatScope,
  sendMatchChatMessageSchema,
} from "./types";

function otherParticipant(context: MatchChatAccessContext, participantId: string): string | null {
  if (context.room.participantAId === participantId) return context.room.participantBId;
  if (context.room.participantBId === participantId) return context.room.participantAId;
  return null;
}

function validateAccess(
  context: MatchChatAccessContext | null,
  scope: MatchChatScope,
  now: Date,
): MatchChatResult<MatchChatAccessContext> {
  if (!context || !otherParticipant(context, scope.participantId))
    return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
  const config = matchChatConfigSchema.safeParse(context.config);
  if (!config.success || !config.data.enabled) return { ok: false, code: "MATCH_CHAT_DISABLED", status: 403 };
  if (!context.eligibilityActive || context.room.status === "closed")
    return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
  if (context.room.status === "blocked") return { ok: false, code: "MATCH_CHAT_BLOCKED", status: 403 };
  if (now >= context.room.closesAt) return { ok: false, code: "MATCH_CHAT_EXPIRED", status: 409 };
  return { ok: true, data: { ...context, config: config.data } };
}

export class EnsureMatchChatRoom {
  constructor(
    private readonly repository: MatchChatSafetyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatScope, matchCandidateId: string): Promise<MatchChatResult<MatchChatRoomSetup>> {
    const configResult = matchChatConfigSchema.safeParse(await this.repository.findConfig(scope));
    if (!configResult.success || !configResult.data.enabled)
      return { ok: false, code: "MATCH_CHAT_DISABLED", status: 403 };
    const eligibility = await this.repository.findEligibility(scope, matchCandidateId);
    if (!eligibility || !eligibility.resultConfirmationActive)
      return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
    if (![eligibility.participantAId, eligibility.participantBId].includes(scope.participantId))
      return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };

    const closesAt = new Date(eligibility.resultPublishedAt.getTime() + configResult.data.windowHours * 3_600_000);
    const now = this.now();
    if (now < eligibility.resultPublishedAt) return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
    if (now >= closesAt) return { ok: false, code: "MATCH_CHAT_EXPIRED", status: 409 };
    const existing = await this.repository.findRoom(scope, eligibility.matchCandidateId);
    if (existing) {
      const access = validateAccess({ config: configResult.data, room: existing, eligibilityActive: true }, scope, now);
      if (!access.ok) return access;
      const consented = await this.repository.listActiveConsentParticipantIds(scope, existing.id);
      return {
        ok: true,
        data: {
          room: access.data.room,
          termsVersion: configResult.data.termsVersion!,
          maxMessageLength: configResult.data.maxMessageLength,
          participantConsented: consented.includes(scope.participantId),
        },
      };
    }
    return {
      ok: true,
      data: {
        room: await this.repository.createRoom(scope, eligibility, closesAt, now),
        termsVersion: configResult.data.termsVersion!,
        maxMessageLength: configResult.data.maxMessageLength,
        participantConsented: false,
      },
    };
  }
}

export class GetMatchChatAvailability {
  constructor(private readonly repository: MatchChatSafetyRepository) {}

  async execute(scope: MatchChatScope): Promise<{ enabled: boolean }> {
    const parsed = matchChatConfigSchema.safeParse(await this.repository.findConfig(scope));
    return { enabled: parsed.success && parsed.data.enabled };
  }
}

function messageAccess(
  context: MatchChatAccessContext | null,
  scope: MatchChatScope,
  now: Date,
): MatchChatResult<MatchChatAccessContext> {
  const access = validateAccess(context, scope, now);
  if (!access.ok) return access;
  if (access.data.room.status !== "open") return { ok: false, code: "MATCH_CHAT_CONSENT_REQUIRED", status: 403 };
  return access;
}

export class SendMatchChatMessage {
  constructor(
    private readonly repository: MatchChatSafetyRepository,
    private readonly cipher: MatchChatMessageCipher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatScope, roomId: string, input: unknown): Promise<MatchChatResult<MatchChatMessage>> {
    const parsed = sendMatchChatMessageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "MATCH_CHAT_INVALID_MESSAGE", status: 400 };
    const now = this.now();
    const access = messageAccess(await this.repository.findAccessContext(scope, roomId), scope, now);
    if (!access.ok) return access;
    if (parsed.data.body.length > access.data.config.maxMessageLength)
      return { ok: false, code: "MATCH_CHAT_INVALID_MESSAGE", status: 400 };

    const cipherContext = {
      tenantId: scope.tenantId,
      eventId: scope.eventId,
      roomId,
      senderParticipantId: scope.participantId,
      clientMessageId: parsed.data.clientMessageId,
    };
    let encrypted: { ciphertext: string; version: string };
    try {
      encrypted = await this.cipher.encrypt(parsed.data.body, cipherContext);
    } catch {
      return { ok: false, code: "MATCH_CHAT_UNAVAILABLE", status: 503 };
    }
    const expiresAt = new Date(now.getTime() + access.data.config.retentionDays! * 86_400_000);
    const saved = await this.repository.saveEncryptedMessage(scope, roomId, {
      clientMessageId: parsed.data.clientMessageId,
      encryptedBody: encrypted.ciphertext,
      encryptionVersion: encrypted.version,
      sentAt: now,
      expiresAt,
      messagesPerMinute: access.data.config.messagesPerMinute,
    });
    if (saved.status === "not_available") return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
    if (saved.status === "rate_limited") return { ok: false, code: "MATCH_CHAT_RATE_LIMITED", status: 429 };
    let body = parsed.data.body;
    if (saved.status === "idempotent") {
      try {
        body = await this.cipher.decrypt(saved.message.encryptedBody, saved.message.encryptionVersion, cipherContext);
      } catch {
        return { ok: false, code: "MATCH_CHAT_UNAVAILABLE", status: 503 };
      }
    }
    return {
      ok: true,
      data: {
        id: saved.message.id,
        sender: "self",
        body,
        sentAt: saved.message.sentAt.toISOString(),
      },
    };
  }
}

export class ListMatchChatMessages {
  constructor(
    private readonly repository: MatchChatSafetyRepository,
    private readonly cipher: MatchChatMessageCipher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatScope, roomId: string): Promise<MatchChatResult<MatchChatMessage[]>> {
    const now = this.now();
    const access = messageAccess(await this.repository.findAccessContext(scope, roomId), scope, now);
    if (!access.ok) return access;
    const encrypted = await this.repository.listEncryptedMessages(scope, roomId, now, 100);
    try {
      const messages = await Promise.all(
        encrypted.map(async (message) => ({
          id: message.id,
          sender: message.senderParticipantId === scope.participantId ? ("self" as const) : ("match" as const),
          body: await this.cipher.decrypt(message.encryptedBody, message.encryptionVersion, {
            tenantId: scope.tenantId,
            eventId: scope.eventId,
            roomId,
            senderParticipantId: message.senderParticipantId,
            clientMessageId: message.clientMessageId,
          }),
          sentAt: message.sentAt.toISOString(),
        })),
      );
      return { ok: true, data: messages };
    } catch {
      return { ok: false, code: "MATCH_CHAT_UNAVAILABLE", status: 503 };
    }
  }
}

export class AcceptMatchChatConsent {
  constructor(
    private readonly repository: MatchChatSafetyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatScope, roomId: string, termsVersion: string): Promise<MatchChatResult<MatchChatRoom>> {
    const now = this.now();
    const access = validateAccess(await this.repository.findAccessContext(scope, roomId), scope, now);
    if (!access.ok) return access;
    if (termsVersion !== access.data.config.termsVersion)
      return { ok: false, code: "MATCH_CHAT_TERMS_CHANGED", status: 409 };
    await this.repository.acceptConsent(scope, roomId, termsVersion, now);
    const consented = new Set(await this.repository.listActiveConsentParticipantIds(scope, roomId));
    if (consented.has(access.data.room.participantAId) && consented.has(access.data.room.participantBId)) {
      return { ok: true, data: await this.repository.openRoom(scope, roomId, now) };
    }
    return { ok: true, data: access.data.room };
  }
}

export class BlockMatchChatRoom {
  constructor(
    private readonly repository: MatchChatSafetyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatScope, roomId: string): Promise<MatchChatResult<{ blocked: true }>> {
    const now = this.now();
    const access = validateAccess(await this.repository.findAccessContext(scope, roomId), scope, now);
    if (!access.ok) return access;
    const target = otherParticipant(access.data, scope.participantId);
    if (!target) return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
    await this.repository.blockRoom(scope, roomId, target, now);
    return { ok: true, data: { blocked: true } };
  }
}

export class ReportMatchChatParticipant {
  constructor(
    private readonly repository: MatchChatSafetyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    scope: MatchChatScope,
    roomId: string,
    input: unknown,
  ): Promise<MatchChatResult<{ reported: true; blocked: true }>> {
    const parsed = matchChatReportSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "MATCH_CHAT_INVALID_REPORT", status: 400 };
    const now = this.now();
    const access = validateAccess(await this.repository.findAccessContext(scope, roomId), scope, now);
    if (!access.ok) return access;
    const target = otherParticipant(access.data, scope.participantId);
    if (!target) return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
    await this.repository.createReport(scope, roomId, target, parsed.data, now);
    await this.repository.blockRoom(scope, roomId, target, now);
    return { ok: true, data: { reported: true, blocked: true } };
  }
}
