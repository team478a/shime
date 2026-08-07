import type { MatchChatSafetyRepository } from "./repository";
import {
  type MatchChatAccessContext,
  matchChatConfigSchema,
  matchChatReportSchema,
  type MatchChatResult,
  type MatchChatRoom,
  type MatchChatScope,
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

  async execute(scope: MatchChatScope): Promise<MatchChatResult<MatchChatRoom>> {
    const configResult = matchChatConfigSchema.safeParse(await this.repository.findConfig(scope));
    if (!configResult.success || !configResult.data.enabled)
      return { ok: false, code: "MATCH_CHAT_DISABLED", status: 403 };
    const eligibility = await this.repository.findEligibility(scope);
    if (!eligibility || !eligibility.resultConfirmationActive)
      return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };
    if (![eligibility.participantAId, eligibility.participantBId].includes(scope.participantId))
      return { ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 };

    const closesAt = new Date(eligibility.resultPublishedAt.getTime() + configResult.data.windowHours * 3_600_000);
    const now = this.now();
    if (now >= closesAt) return { ok: false, code: "MATCH_CHAT_EXPIRED", status: 409 };
    const existing = await this.repository.findRoom(scope, eligibility.matchCandidateId);
    if (existing) {
      const access = validateAccess({ config: configResult.data, room: existing, eligibilityActive: true }, scope, now);
      return access.ok ? { ok: true, data: access.data.room } : access;
    }
    return { ok: true, data: await this.repository.createRoom(scope, eligibility, closesAt, now) };
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
