import type { HealthMonitorRunSummary, HealthMonitorTarget } from "./health-monitor-types";

export interface HealthMonitorRepository {
  listEnabledTargets(): Promise<HealthMonitorTarget[]>;
  recordRun(
    tenantId: string,
    status: "success" | "failed",
    summary: HealthMonitorRunSummary,
    occurredAt: Date,
  ): Promise<void>;
}

export interface HealthCheckProvider {
  check(url: string, timeoutMs: number): Promise<boolean>;
}
