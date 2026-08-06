import type { OperationsAnalyticsRepository } from "./repository";
import type {
  AnonymousAnalyticsSection,
  AnonymousCount,
  OperationsAnalyticsScope,
  OperationsAnalyticsWorkspace,
  RawAnonymousCount,
} from "./types";

export const MINIMUM_ANONYMOUS_COHORT = 5;
export const MINIMUM_ANONYMOUS_CELL = 3;

export class OperationsAnalyticsError extends Error {
  constructor(readonly code: "EVENT_NOT_FOUND") {
    super(code);
  }
}

function hideCount(): AnonymousCount {
  return { value: null, suppressed: true };
}

function protectCount(value: number, cohortAvailable: boolean): AnonymousCount {
  if (!cohortAvailable || (value > 0 && value < MINIMUM_ANONYMOUS_CELL)) return hideCount();
  return { value, suppressed: false };
}

function protectSection(
  cohortSize: number,
  metrics: Record<string, number>,
  distribution: RawAnonymousCount[],
  linkedTotalMetric: string,
): AnonymousAnalyticsSection {
  const available = cohortSize >= MINIMUM_ANONYMOUS_COHORT;
  const protectedDistribution = available
    ? distribution.map((item) => ({ key: item.key, count: protectCount(item.count, true) }))
    : [];
  const protectedMetrics = Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [key, protectCount(value, available)]),
  );
  if (protectedDistribution.some((item) => item.count.suppressed)) protectedMetrics[linkedTotalMetric] = hideCount();
  return {
    available,
    cohortSize: available ? cohortSize : null,
    metrics: protectedMetrics,
    distribution: protectedDistribution,
  };
}

export class GetAnonymousOperationsAnalytics {
  constructor(private readonly repository: OperationsAnalyticsRepository) {}

  async execute(scope: OperationsAnalyticsScope): Promise<OperationsAnalyticsWorkspace> {
    const raw = await this.repository.load(scope);
    if (!raw) throw new OperationsAnalyticsError("EVENT_NOT_FOUND");
    return {
      eventName: raw.eventName,
      privacy: {
        minimumCohortSize: MINIMUM_ANONYMOUS_COHORT,
        minimumCellSize: MINIMUM_ANONYMOUS_CELL,
      },
      interaction: protectSection(
        raw.interaction.cohortSize,
        {
          memoCount: raw.interaction.memoCount,
          favoriteCount: raw.interaction.favoriteCount,
          wantsToTalkMoreCount: raw.interaction.wantsToTalkMoreCount,
        },
        raw.interaction.feelings,
        "memoCount",
      ),
      matchChat: protectSection(
        raw.matchChat.cohortSize,
        {
          roomCount: raw.matchChat.roomCount,
          openRoomCount: raw.matchChat.openRoomCount,
          blockedRoomCount: raw.matchChat.blockedRoomCount,
          messageCount: raw.matchChat.messageCount,
          reportCount: raw.matchChat.reportCount,
        },
        raw.matchChat.reportsByStatus,
        "reportCount",
      ),
    };
  }
}
