import {
  createDrizzleOperationsAnalyticsRepository,
  GetAnonymousOperationsAnalytics,
} from "@shime/operations-analytics";

export const operationsAnalytics = new GetAnonymousOperationsAnalytics(createDrizzleOperationsAnalyticsRepository());
