import type { OperationsAnalyticsScope, RawOperationsAnalytics } from "./types";

export interface OperationsAnalyticsRepository {
  load(scope: OperationsAnalyticsScope): Promise<RawOperationsAnalytics | null>;
}
