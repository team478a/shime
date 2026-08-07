import { defineConfig, devices } from "@playwright/test";
const e2ePort = process.env.PLAYWRIGHT_PORT ?? "3100";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: e2eBaseUrl, trace: "retain-on-failure" },
  projects: [
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm --dir apps/web dev --hostname 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 120_000,
    env: {
      DATABASE_URL: "postgresql://e2e:e2e@127.0.0.1:59999/e2e",
      SESSION_PEPPER: "e2e-session-pepper-at-least-32-characters",
      PASSWORD_PEPPER: "e2e-password-pepper-at-least-32-characters",
      LINK_TOKEN_PEPPER: "e2e-link-token-pepper-at-least-32-characters",
      QR_TOKEN_PEPPER: "e2e-qr-token-pepper-at-least-32-characters",
      INTERNAL_JOB_SECRET: "e2e-internal-job-secret-at-least-32-characters",
      APP_URL: e2eBaseUrl,
      APP_ENV: "test",
      NEXT_PUBLIC_LIFF_ID: "e2e-liff-id",
    },
  },
});
