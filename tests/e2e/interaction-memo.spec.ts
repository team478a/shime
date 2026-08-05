import { expect, type Page, test } from "@playwright/test";

const EVENT_ID = "event-1";
const options = [
  ["reassured", "安心した"],
  ["enjoyed", "楽しかった"],
  ["empathized", "共感した"],
  ["talk_again", "もう一度話したい"],
  ["support", "応援したい"],
  ["no_connection", "ご縁なし"],
].map(([code, label], index) => ({ code, label, displayOrder: index + 1, isNegative: code === "no_connection" }));

async function mockInteractionMemo(page: Page, failFirstSave = false) {
  const notes = new Map<string, { feelingCode: string; favorite: boolean; revision: number; savedAt: string }>();
  let shouldFail = failFirstSave;
  await page.route(`**/api/liff/events/${EVENT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          name: "ワンタップメモUAT",
          statusLabel: "イベント進行中",
          startsAt: "2026-08-08T05:00:00.000Z",
          endsAt: "2026-08-08T07:00:00.000Z",
          venueName: "検証会場",
          venueAddress: null,
          participantJourney: [],
        },
      }),
    }),
  );
  await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          enabled: true,
          snapshotVersion: 1,
          editableUntil: "2026-08-08T07:00:00.000Z",
          options,
          targets: Array.from({ length: 8 }, (_, index) => {
            const targetParticipantId = `1000000${index}-0000-4000-8000-000000000001`;
            const interactionSlotId = `2000000${index}-0000-4000-8000-000000000001`;
            const saved = notes.get(targetParticipantId);
            return {
              interactionSlotId,
              targetParticipantId,
              participantNumber: `B0${index + 1}`,
              roundNo: index + 1,
              note: saved ? { id: `note-${index}`, interactionSlotId, targetParticipantId, ...saved } : null,
            };
          }),
        },
      }),
    });
  });
  await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo/*/*`, async (route) => {
    if (shouldFail) {
      shouldFail = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "UNAVAILABLE" }),
      });
    }
    const targetParticipantId = route.request().url().split("/").at(-1)!;
    const body = route.request().postDataJSON() as { feelingCode: string; favorite: boolean; expectedRevision: number };
    const current = notes.get(targetParticipantId);
    const revision = (current?.revision ?? 0) + 1;
    const savedAt = new Date().toISOString();
    notes.set(targetParticipantId, { feelingCode: body.feelingCode, favorite: body.favorite, revision, savedAt });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: `note-${targetParticipantId}`,
          interactionSlotId: route.request().url().split("/").at(-2),
          targetParticipantId,
          feelingCode: body.feelingCode,
          favorite: body.favorite,
          revision,
          savedAt,
        },
      }),
    });
  });
}

test.describe("ワンタップメモ（320px）", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "モバイル幅プロジェクトでのみ検証する");
  });

  test("氏名を表示せず8人へ連続入力し、選択変更とお気に入りを自動保存できる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mockInteractionMemo(page);
    await page.goto(`/liff/interactions?eventId=${EVENT_ID}`);

    for (let index = 1; index <= 8; index += 1) {
      const card = page.locator("article").filter({ has: page.getByRole("heading", { name: `B0${index}との会話` }) });
      await card.getByRole("button", { name: "安心した" }).click();
      await expect(card.getByText(/保存済み/)).toBeVisible();
    }
    const first = page.locator("article").filter({ has: page.getByRole("heading", { name: "B01との会話" }) });
    await first.getByRole("button", { name: "楽しかった" }).click();
    await expect(first.getByRole("button", { name: "楽しかった" })).toHaveAttribute("aria-pressed", "true");
    await first.getByRole("button", { name: "☆ お気に入り" }).click();
    await expect(first.getByRole("button", { name: "★ お気に入り" })).toHaveAttribute("aria-pressed", "true");
    await expect(first.getByText(/保存済み/)).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
    await expect(page.getByText("参加者氏名")).toHaveCount(0);
    await expect(page.getByText("example@example.com")).toHaveCount(0);
  });

  test("通信失敗後も選択を保持し、同じカードから再試行できる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mockInteractionMemo(page, true);
    await page.goto(`/liff/interactions?eventId=${EVENT_ID}`);

    const first = page.locator("article").filter({ has: page.getByRole("heading", { name: "B01との会話" }) });
    await first.getByRole("button", { name: "安心した" }).click();
    await expect(first.getByText("保存できませんでした。通信状態を確認して再試行してください。")).toBeVisible();
    await expect(first.getByRole("button", { name: "安心した" })).toHaveAttribute("aria-pressed", "true");
    await first.getByRole("button", { name: "再試行" }).click();
    await expect(first.getByText(/保存済み/)).toBeVisible();
  });
});
