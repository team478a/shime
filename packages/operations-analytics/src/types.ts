export type OperationsAnalyticsScope = {
  tenantId: string;
  eventId: string;
  serviceType: string;
};

export type RawAnonymousCount = {
  key: string;
  count: number;
};

export type RawOperationsAnalytics = {
  eventName: string;
  interaction: {
    cohortSize: number;
    memoCount: number;
    favoriteCount: number;
    wantsToTalkMoreCount: number;
    feelings: RawAnonymousCount[];
  };
  matchChat: {
    cohortSize: number;
    roomCount: number;
    openRoomCount: number;
    blockedRoomCount: number;
    messageCount: number;
    reportCount: number;
    reportsByStatus: RawAnonymousCount[];
  };
};

export type AnonymousCount = {
  value: number | null;
  suppressed: boolean;
};

export type AnonymousAnalyticsSection = {
  available: boolean;
  cohortSize: number | null;
  metrics: Record<string, AnonymousCount>;
  distribution: Array<{ key: string; count: AnonymousCount }>;
};

export type OperationsAnalyticsWorkspace = {
  eventName: string;
  privacy: {
    minimumCohortSize: number;
    minimumCellSize: number;
  };
  interaction: AnonymousAnalyticsSection;
  matchChat: AnonymousAnalyticsSection;
};
