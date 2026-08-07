import type { MatchChatAdminRepository } from "./repository";
import {
  type MatchChatAdminScope,
  type MatchChatAdminWorkspace,
  type MatchChatConfig,
  matchChatConfigSchema,
  updateMatchChatReportSchema,
} from "./types";

export const defaultMatchChatConfig = {
  enabled: false,
  windowHours: 72,
  messagesPerMinute: 10,
  maxMessageLength: 500,
  termsVersion: null,
  termsBody: null,
  retentionDays: null,
  reportOwnerLabel: null,
  uatConfirmed: false,
} as const;

export class MatchChatAdminError extends Error {
  constructor(
    public readonly code:
      | "EVENT_NOT_FOUND"
      | "INVALID_MATCH_CHAT_CONFIG"
      | "MATCH_CHAT_REPORT_NOT_FOUND"
      | "MATCH_CHAT_REPORT_INVALID_STATE",
  ) {
    super(code);
  }
}

export class GetMatchChatAdminWorkspace {
  constructor(private readonly repository: MatchChatAdminRepository) {}

  async execute(scope: MatchChatAdminScope): Promise<MatchChatAdminWorkspace> {
    const workspace = await this.repository.loadWorkspace(scope);
    if (!workspace) throw new MatchChatAdminError("EVENT_NOT_FOUND");
    return {
      eventName: workspace.eventName,
      config: workspace.config ?? defaultMatchChatConfig,
      reports: workspace.reports,
    };
  }
}

export class SaveMatchChatConfig {
  constructor(
    private readonly repository: MatchChatAdminRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatAdminScope, input: unknown): Promise<MatchChatAdminWorkspace> {
    const parsed = matchChatConfigSchema.safeParse(input);
    if (!parsed.success) throw new MatchChatAdminError("INVALID_MATCH_CHAT_CONFIG");
    const current = await this.repository.loadWorkspace(scope);
    if (!current) throw new MatchChatAdminError("EVENT_NOT_FOUND");
    if (
      current.config?.uatConfirmed &&
      parsed.data.uatConfirmed &&
      safetySettingsChanged(current.config, parsed.data)
    ) {
      throw new MatchChatAdminError("INVALID_MATCH_CHAT_CONFIG");
    }
    const saved = await this.repository.saveConfig(scope, parsed.data, this.now());
    if (!saved) throw new MatchChatAdminError("EVENT_NOT_FOUND");
    const workspace = await this.repository.loadWorkspace(scope);
    if (!workspace) throw new MatchChatAdminError("EVENT_NOT_FOUND");
    return { eventName: workspace.eventName, config: saved, reports: workspace.reports };
  }
}

function safetySettingsChanged(current: MatchChatConfig, next: MatchChatConfig) {
  return (
    current.windowHours !== next.windowHours ||
    current.messagesPerMinute !== next.messagesPerMinute ||
    current.maxMessageLength !== next.maxMessageLength ||
    current.termsVersion !== next.termsVersion ||
    current.termsBody !== next.termsBody ||
    current.retentionDays !== next.retentionDays ||
    current.reportOwnerLabel !== next.reportOwnerLabel
  );
}

export class UpdateMatchChatReportStatus {
  constructor(
    private readonly repository: MatchChatAdminRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(scope: MatchChatAdminScope, reportId: string, input: unknown) {
    const parsed = updateMatchChatReportSchema.safeParse(input);
    if (!parsed.success) throw new MatchChatAdminError("MATCH_CHAT_REPORT_INVALID_STATE");
    const report = await this.repository.updateReportStatus(scope, reportId, parsed.data.status, this.now());
    if (!report) throw new MatchChatAdminError("MATCH_CHAT_REPORT_NOT_FOUND");
    return report;
  }
}

export class PurgeExpiredMatchChatMessages {
  constructor(
    private readonly repository: MatchChatAdminRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(limit = 1000) {
    const boundedLimit = Math.max(1, Math.min(limit, 5000));
    return { purged: await this.repository.purgeExpiredMessages(this.now(), boundedLimit) };
  }
}
