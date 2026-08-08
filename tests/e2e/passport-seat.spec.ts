import { expect, type Page, test } from "@playwright/test";

async function mockPassport(
  page: Page,
  seat: { tableCode: string; seatCode: string } | null,
  seatingMode: "assigned" | "standing" = "assigned",
) {
  await page.route("**/api/liff/events/event-1", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          name: "UATイベント",
          statusLabel: "イベント進行中",
          startsAt: "2026-08-08T05:00:00.000Z",
          endsAt: null,
          venueName: "UAT会場",
          venueAddress: null,
          seatingMode,
        },
      }),
    }),
  );
  await page.route("**/api/liff/me/passport/event-1", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          participantNumber: "A01",
          status: "checked_in",
          receptionCategoryLabel: "グループA",
          receptionNumber: 1,
        },
      }),
    }),
  );
  await page.route("**/api/liff/events/event-1/seat", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: seat
          ? {
              ...seat,
              explanation: { mode: "fixed_text" },
              publishedAt: "2026-07-31T04:00:00.000Z",
            }
          : null,
      }),
    }),
  );
}

test("SHIME PASSに本人の公開済み席だけを表示する", async ({ page }) => {
  await mockPassport(page, { tableCode: "T01", seatCode: "T01-1" });

  await page.goto("/liff/passport?eventId=event-1");

  await expect(page.getByRole("heading", { name: "現在の席" })).toBeVisible();
  await expect(page.getByText("T01", { exact: true })).toBeVisible();
  await expect(page.getByText("T01-1", { exact: true })).toBeVisible();
  await expect(page.getByText("運営が公開した席です。当日はこの席へお進みください。")).toBeVisible();
  await expect(page.getByText("T01-2", { exact: true })).toHaveCount(0);
});

test("未公開または未配置では席案内準備中と表示する", async ({ page }) => {
  await mockPassport(page, null);

  await page.goto("/liff/passport?eventId=event-1");

  await expect(page.getByText("席案内は準備中です。運営が公開すると、ここに表示されます。")).toBeVisible();
  await expect(page.getByRole("button", { name: "席案内を更新" })).toBeVisible();
});

test("立食イベントでは席案内を表示しない", async ({ page }) => {
  await mockPassport(page, { tableCode: "T01", seatCode: "T01-1" }, "standing");

  await page.goto("/liff/passport?eventId=event-1");

  await expect(page.getByRole("heading", { name: "現在の席" })).toHaveCount(0);
  await expect(page.getByText("席案内は準備中です。運営が公開すると、ここに表示されます。")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "席案内を更新" })).toHaveCount(0);
});
