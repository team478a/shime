import { describe, expect, it } from "vitest";
import {
  AcceptMatchChatConsent,
  BlockMatchChatRoom,
  EnsureMatchChatRoom,
  type MatchChatAccessContext,
  type MatchChatConfig,
  matchChatConfigSchema,
  type MatchChatEligibility,
  type MatchChatReportInput,
  type MatchChatRoom,
  type MatchChatSafetyRepository,
  type MatchChatScope,
  ReportMatchChatParticipant,
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
}

describe("match chat safety foundation", () => {
  it("cannot enable chat until terms and retention are configured", () => {
    expect(matchChatConfigSchema.safeParse({ ...config, termsVersion: null, retentionDays: null }).success).toBe(false);
    expect(
      matchChatConfigSchema.safeParse({ ...config, enabled: false, termsVersion: null, retentionDays: null }).success,
    ).toBe(true);
  });

  it("creates a 72-hour room only for an active approved result", async () => {
    const repository = new FakeRepository();
    const result = await new EnsureMatchChatRoom(repository, () => now).execute(scope);
    expect(result).toMatchObject({ ok: true, data: { status: "pending_consent" } });
    if (result.ok) expect(result.data.closesAt.toISOString()).toBe("2026-08-11T07:00:00.000Z");

    repository.eligibility = { ...eligibility, resultConfirmationActive: false };
    expect(await new EnsureMatchChatRoom(repository, () => now).execute(scope)).toEqual({
      ok: false,
      code: "MATCH_CHAT_NOT_AVAILABLE",
      status: 404,
    });
  });

  it("opens only after both participants accept the current terms", async () => {
    const repository = new FakeRepository();
    await new EnsureMatchChatRoom(repository, () => now).execute(scope);
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
    await new EnsureMatchChatRoom(repository, () => now).execute(scope);
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
    await new EnsureMatchChatRoom(repository, () => now).execute(scope);
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
});
