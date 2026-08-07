import { describe, expect, it } from "vitest";
import {
  defaultMatchChatConfig,
  GetMatchChatAdminWorkspace,
  MatchChatAdminError,
  type MatchChatAdminReport,
  type MatchChatAdminRepository,
  type MatchChatAdminScope,
  type MatchChatConfig,
  PurgeExpiredMatchChatMessages,
  SaveMatchChatConfig,
  UpdateMatchChatReportStatus,
} from "@shime/match-chat";

const scope: MatchChatAdminScope = {
  tenantId: "tenant-a",
  eventId: "event-a",
  serviceType: "marriage",
  actorUserId: "staff-a",
  requestId: "00000000-0000-0000-0000-000000000001",
};

const enabledConfig: MatchChatConfig = {
  enabled: true,
  windowHours: 72,
  messagesPerMinute: 10,
  maxMessageLength: 500,
  termsVersion: "match-chat-v1",
  termsBody: "相手を尊重し、安全に利用してください。",
  retentionDays: 30,
  reportOwnerLabel: "当日運営責任者",
  uatConfirmed: true,
};

const report: MatchChatAdminReport = {
  id: "report-a",
  roomId: "room-a",
  reporterParticipantNumber: "A01",
  reportedParticipantNumber: "B01",
  category: "safety_concern",
  detail: "運営に確認してほしい",
  status: "open",
  createdAt: "2026-08-08T08:00:00.000Z",
  resolvedAt: null,
};

class FakeAdminRepository implements MatchChatAdminRepository {
  eventFound = true;
  config: MatchChatConfig | null = null;
  reports = [report];
  purgeLimit = 0;

  async loadWorkspace() {
    return this.eventFound ? { eventName: "Event A", config: this.config, reports: this.reports } : null;
  }
  async saveConfig(_scope: MatchChatAdminScope, config: MatchChatConfig) {
    if (!this.eventFound) return null;
    this.config = config;
    return config;
  }
  async updateReportStatus(_scope: MatchChatAdminScope, reportId: string, status: "reviewing" | "resolved", now: Date) {
    const current = this.reports.find((item) => item.id === reportId);
    if (!current || current.status === "resolved") return null;
    const updated: MatchChatAdminReport = {
      ...current,
      status,
      resolvedAt: status === "resolved" ? now.toISOString() : null,
    };
    this.reports = this.reports.map((item) => (item.id === reportId ? updated : item));
    return updated;
  }
  async purgeExpiredMessages(_now: Date, limit: number) {
    this.purgeLimit = limit;
    return 3;
  }
}

describe("match chat admin", () => {
  it("loads fail-closed defaults without creating an enabled configuration", async () => {
    const repository = new FakeAdminRepository();
    const workspace = await new GetMatchChatAdminWorkspace(repository).execute(scope);
    expect(workspace.eventName).toBe("Event A");
    expect(workspace.config).toEqual(defaultMatchChatConfig);
    expect(workspace.reports).toEqual([report]);
  });

  it("rejects enablement until every operational safety gate is complete", async () => {
    const repository = new FakeAdminRepository();
    await expect(
      new SaveMatchChatConfig(repository).execute(scope, {
        ...enabledConfig,
        termsVersion: null,
        termsBody: null,
        retentionDays: null,
        reportOwnerLabel: null,
        uatConfirmed: false,
      }),
    ).rejects.toMatchObject({ code: "INVALID_MATCH_CHAT_CONFIG" } satisfies Partial<MatchChatAdminError>);
    expect(repository.config).toBeNull();
  });

  it("saves a valid scoped configuration and returns the report queue", async () => {
    const repository = new FakeAdminRepository();
    const workspace = await new SaveMatchChatConfig(repository).execute(scope, enabledConfig);
    expect(workspace).toEqual({ eventName: "Event A", config: enabledConfig, reports: [report] });
  });

  it("moves an open report through reviewing and resolved without exposing chat messages", async () => {
    const repository = new FakeAdminRepository();
    const now = new Date("2026-08-08T09:00:00.000Z");
    const update = new UpdateMatchChatReportStatus(repository, () => now);
    expect(await update.execute(scope, report.id, { status: "reviewing" })).toMatchObject({ status: "reviewing" });
    expect(await update.execute(scope, report.id, { status: "resolved" })).toMatchObject({
      status: "resolved",
      resolvedAt: now.toISOString(),
    });
  });

  it("bounds retention deletion batches", async () => {
    const repository = new FakeAdminRepository();
    expect(await new PurgeExpiredMatchChatMessages(repository).execute(100_000)).toEqual({ purged: 3 });
    expect(repository.purgeLimit).toBe(5000);
  });
});
