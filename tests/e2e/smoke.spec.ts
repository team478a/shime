import { expect, test } from "@playwright/test";
test("検証環境バナーと公開トップを表示する", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SHIME/);
  await expect(page.getByText(/検証環境（test）/)).toBeVisible();
});
test("未認証の管理画面アクセスをログインへ戻す", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "SHIME 運営ログイン" })).toBeVisible();
});
test("未認証の管理APIをrequest ID付きで拒否する", async ({ request }) => {
  const response = await request.get("/api/admin/events");
  expect(response.status()).toBe(401);
  expect(response.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
});
test("公開ヘルスチェックは機密情報を含まず応答する", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  expect(await response.json()).toMatchObject({ status: "ok" });
});
test("内部ヘルスチェックと運用ジョブは未認証リクエストを拒否する", async ({ request }) => {
  expect((await request.get("/api/health/readiness")).status()).toBe(401);
  expect((await request.get("/api/jobs/health-monitor")).status()).toBe(401);
  const notificationResponse = await request.post("/api/jobs/notifications", {
    headers: { "x-request-id": "e2e-notification-request" },
  });
  expect(notificationResponse.status()).toBe(401);
  expect(notificationResponse.headers()["cache-control"]).toContain("no-store");
  expect(notificationResponse.headers()["x-request-id"]).toBe("e2e-notification-request");
  expect(await notificationResponse.json()).toEqual({
    code: "UNAUTHORIZED",
    request_id: "e2e-notification-request",
  });
});
test("検証環境は検索エンジンに全ページ拒否を指示する", async ({ request }) => {
  const page = await request.get("/");
  expect(page.headers()["x-robots-tag"]).toContain("noindex");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  expect(page.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
});
test("AIコンシェルジュ仕様レビューを公開URLから取得できる", async ({ request }) => {
  const response = await request.get("/downloads/SHIME_CONCIERGE_SPEC_REVIEW.md");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("# SHIME® 婚活AIコンシェルジュ 段階開発指示書レビュー");
});
test("AIコンシェルジュPhase 0進捗を公開URLから取得できる", async ({ request }) => {
  const response = await request.get("/downloads/SHIME_CONCIERGE_PHASE0_STATUS.md");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/markdown");
  expect(await response.text()).toContain("# SHIME® 婚活AIコンシェルジュ Phase 0 進捗・未決事項");
});
test("スマートフォン幅で参加者画面が横にはみ出さない", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  for (const path of ["/liff/dream", "/liff/questionnaire", "/liff/passport", "/liff/preferences", "/liff/result"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(false);
  }
});
test("参加者画面にEMOKATSU婚活とSHIME PASSの共通表示がある", async ({ page }) => {
  await page.goto("/liff/passport");
  await expect(page.getByText("EMOKATSU 婚活", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SHIME® PASS" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "イベント参加の進行" })).toBeVisible();
  await expect(page.getByText("URLにイベント情報がありません。LINEの案内から開き直してください。")).toBeVisible();
  await expect(page.getByText("Powered by SHIME®", { exact: true })).toBeVisible();
});
test("希望入力はイベント情報がない場合に操作を出さない", async ({ page }) => {
  await page.goto("/liff/preferences");
  await expect(page.getByText("希望入力期間外、または候補を読み込めませんでした。")).toBeVisible();
  await expect(page.getByRole("button", { name: "途中保存" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "今回は選ばず提出" })).toHaveCount(0);
});
test("参加者導線はイベント情報がない場合に安全に停止する", async ({ page }) => {
  await page.goto("/liff/dream");
  await expect(page.getByText("感情カードを読み込めませんでした。LINEの案内から開き直してください。")).toBeVisible();
  await expect(page.getByRole("button", { name: "今回は登録せず進む" })).toHaveCount(0);

  await page.goto("/liff/questionnaire");
  await expect(page.getByText("質問を読み込めませんでした。LINEの案内から開き直してください。")).toBeVisible();
  await expect(page.getByRole("button", { name: "5問を提出" })).toHaveCount(0);

  await page.goto("/liff/passport");
  await expect(page.getByText("SHIME® PASSを確認できませんでした。LINEの案内から開き直してください。")).toBeVisible();
  await expect(page.getByRole("button", { name: "SHIME® PASSを発行" })).toHaveCount(0);

  await page.goto("/liff/result");
  await expect(page.getByText("ご案内を確認できませんでした。LINEの案内から開き直してください。")).toBeVisible();
});
test("Dream回答保存後に候補生成だけを再試行できる", async ({ page }) => {
  let suggestionRequests = 0;
  await page.route("**/api/liff/events/event-1", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          name: "テスト交流会",
          statusLabel: "イベント進行中",
          startsAt: "2026-08-08T05:00:00.000Z",
          endsAt: null,
          venueName: "テスト会場",
          venueAddress: null,
        },
      }),
    }),
  );
  await page.route("**/api/liff/events/event-1/emotion-cards", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          registrationMode: "optional",
          cards: [
            { id: "11111111-1111-4111-8111-111111111111", name: "希望", imageKey: null, description: "明るい未来" },
          ],
        },
      }),
    }),
  );
  await page.route("**/api/liff/events/event-1/emotion-selection", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { saved: true } }),
    }),
  );
  await page.route("**/api/liff/events/event-1/dream/suggestions", async (route) => {
    suggestionRequests += 1;
    await route.fulfill(
      suggestionRequests === 1
        ? {
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ code: "TEMPORARY_FAILURE" }),
          }
        : {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: { candidates: ["穏やかな家庭を育てる", "新しい一歩を踏み出す", "安心できる関係を築く"] },
            }),
          },
    );
  });

  await page.goto("/liff/dream?eventId=event-1");
  await page.getByRole("button", { name: /希望/ }).click();
  await page.getByLabel("第一印象").fill("明るい");
  await page.getByLabel("どの領域に関係しますか").fill("未来");
  await page.getByLabel("その奥にある願い").fill("安心");
  await page.getByRole("button", { name: "夢候補を見る" }).click();
  await expect(page.getByRole("heading", { name: "回答は保存されています" })).toBeVisible();
  await page.getByRole("button", { name: "夢候補を再読込" }).click();
  await expect(page.getByRole("heading", { name: "夢候補" })).toBeVisible();
  await expect(page.getByRole("button", { name: "穏やかな家庭を育てる" })).toBeVisible();
  expect(suggestionRequests).toBe(2);
});
