import type { HealthCheckProvider, HealthMonitorRepository } from "./health-monitor-repository";
import type { HealthMonitorResult } from "./health-monitor-types";

type RunHealthMonitorInput = {
  defaultHealthcheckUrl: string;
  timeoutMs?: number;
};

export class RunHealthMonitor {
  constructor(
    private readonly repository: HealthMonitorRepository,
    private readonly provider: HealthCheckProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: RunHealthMonitorInput): Promise<HealthMonitorResult> {
    const targets = await this.repository.listEnabledTargets();
    let healthy = 0;
    let failed = 0;

    for (const target of targets) {
      const ok = await this.provider
        .check(target.healthcheckUrl ?? input.defaultHealthcheckUrl, input.timeoutMs ?? 10_000)
        .catch(() => false);
      if (ok) healthy += 1;
      else failed += 1;

      await this.repository.recordRun(
        target.tenantId,
        ok ? "success" : "failed",
        { healthy: ok ? 1 : 0, failed: ok ? 0 : 1 },
        this.now(),
      );
    }

    return { checked: targets.length, healthy, failed };
  }
}
