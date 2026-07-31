import { expect, test } from "@playwright/test";

test.describe("web manuals", () => {
  test("opens the manual index and both versioned documents", async ({ page }) => {
    await page.goto("/manual");
    await expect(page.getByRole("heading", { name: "操作マニュアル", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: /参加者操作マニュアル/ }).click();
    await expect(page.getByRole("heading", { name: "SHIME 参加者操作マニュアル", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "マニュアル目次" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Markdown版を保存" })).toHaveAttribute(
      "href",
      "/downloads/SHIME_PARTICIPANT_MANUAL.md",
    );

    await expect(page.getByRole("link", { name: "管理者用" })).toHaveAttribute("href", "/admin/manual");
  });

  test("keeps the participant manual within the mobile viewport", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "モバイル幅プロジェクトでのみ検証する");
    await page.goto("/manual/participant");
    await expect(page.getByRole("heading", { name: "SHIME 参加者操作マニュアル", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  });

  test("requires a staff session for the administrator manual", async ({ page }) => {
    await page.goto("/admin/manual");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "SHIME 運営ログイン" })).toBeVisible();
  });
});
