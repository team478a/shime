import { describe, expect, it } from "vitest";
import {
  AcceptMatchChatConsent,
  BlockMatchChatRoom,
  type EncryptedMatchChatMessage,
  EnsureMatchChatRoom,
  ListMatchChatMessages,
  type MatchChatAccessContext,
  type MatchChatConfig,
  matchChatConfigSchema,
  type MatchChatEligibility,
  type MatchChatMessageCipher,
  type MatchChatReportInput,
  type MatchChatRoom,
  type MatchChatSafetyRepository,
  type MatchChatScope,
  ReportMatchChatParticipant,
  SendMatchChatMessage,
} from "@shime/match-chat";

const now = new Date("2026-08-08T08:00:00.000Z");
const scope: MatchChatScope = {
  tenantId: "tenant-a",
  eventId: "event-a",
  serviceType: "marriage",
  participantId: "participant-a",
};
const config: MatchChatConfig = {
  enabled: true,
  windowHours: 72,
  messagesPerMinute: 10,
  maxMessageLength: 500,
  termsVersion: "chat-terms-v1",
  retentionDays: 30,
};
const eligibility: MatchChatEligibility = {
  matchCandidateId: "match-1",
  participantAId: "participant-a",
  participantBId: "participant-b",
  resultPublishedAt: new Date("2026-08-08T07:00:00.000Z"),
  resultConfirmationActive: true,
};

class FakeRepository implements MatchChatSafetyRepository {
  config: MatchChatConfig | null = config;
  eligibility: MatchChatEligibility | null = eligibility;
  room: MatchChatRoom | null = null;
  consents = new Set<string>();
  blocked: string[] = [];
  reports: MatchChatReportInput[] = [];
  messages: EncryptedMatchChatMessage[] = [];
  rateLimited = false;

  async findConfig() {
    return this.config;
  }
  async findEligibility() {
    return this.eligibility;
  }
  async findRoom() {
    return this.room;
  }
  async createRoom(_scope: MatchChatScope, candidate: MatchChatEligibility, closesAt: Date) {
    this.room = {
      id: "room-1",
      matchCandidateId: candidate.matchCandidateId,
      participantAId: candidate.participantAId,
      participantBId: candidate.participantBId,
      status: "pending_consent",
      opensAt: null,
      closesAt,
    };
    return this.room;
  }
  async findAccessContext(): Promise<MatchChatAccessContext | null> {
    return this.room
      ? { config, room: this.room, eligibilityActive: Boolean(this.eligibility?.resultConfirmationActive) }
      : null;
  }
  async acceptConsent(inputScope: MatchChatScope) {
    this.consents.add(inputScope.participantId);
  }
  async listActiveConsentParticipantIds() {
    return [...this.consents];
  }
  async openRoom() {
    if (!this.room) throw new Error("room missing");
    this.room = { ...this.room, status: "open", opensAt: now };
    return this.room;
  }
  async blockRoom(_scope: MatchChatScope, _roomId: string, target: string) {
    this.blocked.push(target);
    if (this.room) this.room = { ...this.room, status: "blocked" };
  }
  async createReport(_scope: MatchChatScope, _roomId: string, _target: string, input: MatchChatReportInput) {
    this.reports.push(input);
  }
  async saveEncryptedMessage(
    inputScope: MatchChatScope,
    _roomId: string,
    input: {
      clientMessageId: string;
      encryptedBody: string;
      encryptionVersion: string;
      sentAt: Date;
      expiresAt: Date;
    },
  ) {
    const existing = this.messages.find(
      (message) =>
        message.senderParticipantId === inputScope.participantId && message.clientMessageId === input.clientMessageId,
    );
    if (existing) return { status: "idempotent" as const, message: existing };
    if (this.rateLimited) return { status: "rate_limited" as const };
    const message: EncryptedMatchChatMessage = {
      id: `message-${this.messages.length + 1}`,
      senderParticipantId: inputScope.participantId,
      clientMessageId: input.clientMessageId,
      encryptedBody: input.encryptedBody,
      encryptionVersion: input.encryptionVersion,
      sentAt: input.sentAt,
      expiresAt: input.expiresAt,
    };
    this.messages.push(message);
    return { status: "saved" as const, message };
  }
  async listEncryptedMessages() {
    return this.messages;
  }
}

const cipher: MatchChatMessageCipher = {
  async encrypt(body) {
    return { ciphertext: `encrypted:${body}`, version: "test-v1" };
  },
  async decrypt(ciphertext) {
    return ciphertext.replace(/^encrypted:/, "");
  },
};

describe("match chat safety foundation", () => {
  it("cannot enable chat until terms and retention are configured", () => {
    expect(matchChatConfigSchema.safeParse({ ...config, termsVersion: null, retentionDays: null }).success).toBe(false);
    expect(
      matchChatConfigSchema.safeParse({ ...config, enabled: false, termsVersion: null, retentionDays: null }).success,
    ).toBe(true);
  });

  it("creates a 72-hour room only for an active approved result", async () => {
    const repository = new FakeRepository();
    const result = await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    expect(result).toMatchObject({ ok: true, data: { room: { status: "pending_consent" } } });
    if (result.ok) expect(result.data.room.closesAt.toISOString()).toBe("2026-08-11T07:00:00.000Z");

    repository.eligibility = { ...eligibility, resultConfirmationActive: false };
    expect(await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1")).toEqual({
      ok: false,
      code: "MATCH_CHAT_NOT_AVAILABLE",
      status: 404,
    });
  });

  it("opens only after both participants accept the current terms", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    const accept = new AcceptMatchChatConsent(repository, () => now);
    const first = await accept.execute(scope, "room-1", "chat-terms-v1");
    expect(first).toMatchObject({ ok: true, data: { status: "pending_consent" } });
    expect(await accept.execute({ ...scope, participantId: "participant-b" }, "room-1", "old-terms")).toEqual({
      ok: false,
      code: "MATCH_CHAT_TERMS_CHANGED",
      status: 409,
    });
    const second = await accept.execute({ ...scope, participantId: "participant-b" }, "room-1", "chat-terms-v1");
    expect(second).toMatchObject({ ok: true, data: { status: "open" } });
  });

  it("rejects a non-member and an expired room", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    const accept = new AcceptMatchChatConsent(repository, () => now);
    expect(await accept.execute({ ...scope, participantId: "outsider" }, "room-1", "chat-terms-v1")).toEqual({
      ok: false,
      code: "MATCH_CHAT_NOT_AVAILABLE",
      status: 404,
    });
    repository.room = { ...repository.room!, closesAt: now };
    expect(await accept.execute(scope, "room-1", "chat-terms-v1")).toEqual({
      ok: false,
      code: "MATCH_CHAT_EXPIRED",
      status: 409,
    });
  });

  it("blocks immediately and report also blocks the other participant", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    expect(await new BlockMatchChatRoom(repository, () => now).execute(scope, "room-1")).toEqual({
      ok: true,
      data: { blocked: true },
    });
    expect(repository.blocked).toEqual(["participant-b"]);

    repository.room = { ...repository.room!, status: "open" };
    const report = await new ReportMatchChatParticipant(repository, () => now).execute(scope, "room-1", {
      category: "safety_concern",
      detail: "Please review",
    });
    expect(report).toEqual({ ok: true, data: { reported: true, blocked: true } });
    expect(repository.reports).toEqual([{ category: "safety_concern", detail: "Please review" }]);
    expect(repository.blocked).toEqual(["participant-b", "participant-b"]);
  });

  it("sends only after both consents and lists messages without participant identifiers", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    const send = new SendMatchChatMessage(repository, cipher, () => now);
    const input = { clientMessageId: "11111111-1111-4111-8111-111111111111", body: "こんにちは" };
    expect(await send.execute(scope, "room-1", input)).toEqual({
      ok: false,
      code: "MATCH_CHAT_CONSENT_REQUIRED",
      status: 403,
    });

    const accept = new AcceptMatchChatConsent(repository, () => now);
    await accept.execute(scope, "room-1", "chat-terms-v1");
    await accept.execute({ ...scope, participantId: "participant-b" }, "room-1", "chat-terms-v1");
    expect(await send.execute(scope, "room-1", input)).toMatchObject({
      ok: true,
      data: { sender: "self", body: "こんにちは" },
    });
    expect(await new ListMatchChatMessages(repository, cipher, () => now).execute(scope, "room-1")).toMatchObject({
      ok: true,
      data: [{ sender: "self", body: "こんにちは" }],
    });
  });

  it("returns the original message for an idempotent retry and enforces the rate limit", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    repository.room = { ...repository.room!, status: "open", opensAt: now };
    const send = new SendMatchChatMessage(repository, cipher, () => now);
    const clientMessageId = "22222222-2222-4222-8222-222222222222";
    await send.execute(scope, "room-1", { clientMessageId, body: "original" });
    expect(await send.execute(scope, "room-1", { clientMessageId, body: "changed retry" })).toMatchObject({
      ok: true,
      data: { body: "original" },
    });

    repository.rateLimited = true;
    expect(
      await send.execute(scope, "room-1", {
        clientMessageId: "33333333-3333-4333-8333-333333333333",
        body: "too fast",
      }),
    ).toEqual({ ok: false, code: "MATCH_CHAT_RATE_LIMITED", status: 429 });
  });

  it("rechecks result availability and block state for every message operation", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope, "match-1");
    repository.room = { ...repository.room!, status: "open", opensAt: now };
    repository.eligibility = { ...eligibility, resultConfirmationActive: false };
    expect(
      await new SendMatchChatMessage(repository, cipher, () => now).execute(scope, "room-1", {
        clientMessageId: "44444444-4444-4444-8444-444444444444",
        body: "hidden after revoke",
      }),
    ).toEqual({ ok: false, code: "MATCH_CHAT_NOT_AVAILABLE", status: 404 });

    repository.eligibility = eligibility;
    repository.room = { ...repository.room, status: "blocked" };
    expect(await new ListMatchChatMessages(repository, cipher, () => now).execute(scope, "room-1")).toEqual({
      ok: false,
      code: "MATCH_CHAT_BLOCKED",
      status: 403,
    });
  });
});
