import { createDrizzleHealthMonitorRepository, FetchHealthCheckProvider, RunHealthMonitor } from "@shime/integrations";

export const runHealthMonitor = new RunHealthMonitor(
  createDrizzleHealthMonitorRepository(),
  new FetchHealthCheckProvider(),
);
