import { and, eq } from "drizzle-orm";
import { getDatabase, jobSchedules, tenantOperationalSettings } from "@shime/db";
import type { HealthMonitorRepository } from "./health-monitor-repository";
import { healthMonitorRunSummarySchema } from "./health-monitor-types";

export function createDrizzleHealthMonitorRepository(): HealthMonitorRepository {
  return {
    listEnabledTargets() {
      return getDatabase()
        .select({
          tenantId: tenantOperationalSettings.tenantId,
          healthcheckUrl: tenantOperationalSettings.healthcheckUrl,
        })
        .from(tenantOperationalSettings)
        .where(eq(tenantOperationalSettings.monitoringEnabled, true));
    },

    async recordRun(tenantId, status, summary, occurredAt) {
      await getDatabase()
        .update(jobSchedules)
        .set({
          lastRunAt: occurredAt,
          lastRunStatus: status,
          lastRunSummary: healthMonitorRunSummarySchema.parse(summary),
          updatedAt: occurredAt,
        })
        .where(and(eq(jobSchedules.tenantId, tenantId), eq(jobSchedules.jobKey, "health_monitor")));
    },
  };
}
