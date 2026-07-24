import { describe, expect, it, vi } from "vitest";
import type { HealthCheckProvider, HealthMonitorRepository } from "@shime/integrations";
import { RunHealthMonitor } from "@shime/integrations";

const occurredAt = new Date("2026-07-24T01:00:00.000Z");

describe("RunHealthMonitor", () => {
  it("checks each enabled tenant and records scoped results", async () => {
    const recordRun = vi.fn(async () => undefined);
    const repository: HealthMonitorRepository = {
      listEnabledTargets: async () => [
        { tenantId: "tenant-1", healthcheckUrl: "https://tenant-1.example/health" },
        { tenantId: "tenant-2", healthcheckUrl: null },
      ],
      recordRun,
    };
    const provider: HealthCheckProvider = {
      check: vi.fn(async (url) => url.includes("tenant-1")),
    };
    const useCase = new RunHealthMonitor(repository, provider, () => occurredAt);

    await expect(useCase.execute({ defaultHealthcheckUrl: "https://default.example/api/health" })).resolves.toEqual({
      checked: 2,
      healthy: 1,
      failed: 1,
    });
    expect(provider.check).toHaveBeenNthCalledWith(1, "https://tenant-1.example/health", 10_000);
    expect(provider.check).toHaveBeenNthCalledWith(2, "https://default.example/api/health", 10_000);
    expect(recordRun).toHaveBeenNthCalledWith(1, "tenant-1", "success", { healthy: 1, failed: 0 }, occurredAt);
    expect(recordRun).toHaveBeenNthCalledWith(2, "tenant-2", "failed", { healthy: 0, failed: 1 }, occurredAt);
  });

  it("treats a provider failure as an unhealthy check and continues", async () => {
    const recordRun = vi.fn(async () => undefined);
    const repository: HealthMonitorRepository = {
      listEnabledTargets: async () => [{ tenantId: "tenant-1", healthcheckUrl: null }],
      recordRun,
    };
    const provider: HealthCheckProvider = {
      check: async () => {
        throw new Error("network details must not escape");
      },
    };
    const useCase = new RunHealthMonitor(repository, provider, () => occurredAt);

    await expect(useCase.execute({ defaultHealthcheckUrl: "https://default.example/api/health" })).resolves.toEqual({
      checked: 1,
      healthy: 0,
      failed: 1,
    });
    expect(recordRun).toHaveBeenCalledWith("tenant-1", "failed", { healthy: 0, failed: 1 }, occurredAt);
  });

  it("returns zero counts when monitoring is disabled for every tenant", async () => {
    const recordRun = vi.fn(async () => undefined);
    const repository: HealthMonitorRepository = {
      listEnabledTargets: async () => [],
      recordRun,
    };
    const provider: HealthCheckProvider = { check: vi.fn(async () => true) };
    const useCase = new RunHealthMonitor(repository, provider);

    await expect(useCase.execute({ defaultHealthcheckUrl: "https://default.example/api/health" })).resolves.toEqual({
      checked: 0,
      healthy: 0,
      failed: 0,
    });
    expect(provider.check).not.toHaveBeenCalled();
    expect(recordRun).not.toHaveBeenCalled();
  });
});
