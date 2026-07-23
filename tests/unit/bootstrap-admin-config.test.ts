import { describe, expect, it } from "vitest";
import { parseAdminBootstrapConfig } from "../../packages/db/src/bootstrap-admin-config";

const base = {
  APP_ENV: "staging",
  DATABASE_MIGRATION_URL: "postgresql://example.invalid/postgres",
  PASSWORD_PEPPER: "p".repeat(32),
  SEED_ADMIN_PASSWORD: "StrongPassword123",
};

describe("administrator bootstrap configuration", () => {
  it("uses safe staging defaults without event settings", () => {
    const config = parseAdminBootstrapConfig(base);
    expect(config.tenantCode).toBe("shime");
    expect(config.loginId).toBe("admin");
    expect(config.rotatePassword).toBe(false);
  });

  it("requires explicit tenant confirmation in production", () => {
    expect(() => parseAdminBootstrapConfig({ ...base, APP_ENV: "production" })).toThrow();
    expect(() =>
      parseAdminBootstrapConfig({
        ...base,
        APP_ENV: "production",
        BOOTSTRAP_CONFIRM_PRODUCTION: "shime",
      }),
    ).not.toThrow();
  });

  it("does not accept a missing administrator password", () => {
    const withoutPassword: Record<string, string> = { ...base };
    delete withoutPassword.SEED_ADMIN_PASSWORD;
    expect(() => parseAdminBootstrapConfig(withoutPassword)).toThrow();
  });
});
