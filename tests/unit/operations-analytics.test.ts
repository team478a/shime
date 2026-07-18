import { describe, expect, it } from "vitest";

import { completionPercent, operationsMetricState } from "../../apps/web/src/lib/operations-analytics";

describe("operations analytics", () => {
  it("calculates a bounded completion percentage", () => {
    expect(completionPercent(3, 4)).toBe(75);
    expect(completionPercent(2, 0)).toBe(0);
    expect(completionPercent(9, 4)).toBe(100);
  });

  it("classifies empty, in-progress and complete metrics", () => {
    const base = { key: "checkin", label: "受付", unit: "名" as const, href: "/" };
    expect(operationsMetricState({ ...base, completed: 0, total: 4 })).toBe("empty");
    expect(operationsMetricState({ ...base, completed: 2, total: 4 })).toBe("attention");
    expect(operationsMetricState({ ...base, completed: 4, total: 4 })).toBe("complete");
  });
});
