import { describe, expect, it } from "vitest";

import { getAdminPublicDownloads, PUBLIC_DOWNLOADS } from "../../apps/web/src/lib/public-downloads";

describe("public downloads", () => {
  it("publishes the concierge specification review for smartphone download", () => {
    expect(PUBLIC_DOWNLOADS).toContainEqual(expect.objectContaining({
      sourceName: "CONCIERGE_SPEC_REVIEW.md",
      outputName: "SHIME_CONCIERGE_SPEC_REVIEW.md",
    }));
    expect(getAdminPublicDownloads()).toContainEqual(expect.objectContaining({
      outputName: "SHIME_CONCIERGE_SPEC_REVIEW.md",
      label: "AIコンシェルジュ仕様レビュー",
    }));
  });

  it("keeps download output names unique", () => {
    const outputNames = PUBLIC_DOWNLOADS.map((document) => document.outputName);
    expect(new Set(outputNames).size).toBe(outputNames.length);
  });
});
