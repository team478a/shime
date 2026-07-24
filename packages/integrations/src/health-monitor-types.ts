import { z } from "zod";

export type HealthMonitorTarget = {
  tenantId: string;
  healthcheckUrl: string | null;
};

export const healthMonitorRunSummarySchema = z
  .object({
    healthy: z.number().int().min(0),
    failed: z.number().int().min(0),
  })
  .strict();

export type HealthMonitorRunSummary = z.infer<typeof healthMonitorRunSummarySchema>;

export type HealthMonitorResult = {
  checked: number;
  healthy: number;
  failed: number;
};
