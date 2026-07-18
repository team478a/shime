import { describe, expect, it } from "vitest";

import { SHIME_BRAND } from "../../apps/web/src/lib/brand";

describe("SHIME brand identity", () => {
  it("keeps the common platform and marriage service labels separate", () => {
    expect(SHIME_BRAND.platformName).toBe("SHIME®");
    expect(SHIME_BRAND.serviceName).toBe("EMOKATSU婚活");
    expect(SHIME_BRAND.browserTitle).toBe("EMOKATSU婚活｜SHIME®");
    expect(SHIME_BRAND.adminDisplayName).toBe("SHIME® ADMIN / EMOKATSU婚活");
  });

  it("provides the service boundary used by the theme", () => {
    expect(SHIME_BRAND.serviceKey).toBe("emokatsu-marriage");
    expect(SHIME_BRAND.footerLabel).toBe("Powered by SHIME®");
  });
});
