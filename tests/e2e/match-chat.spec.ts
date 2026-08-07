import { expect, test } from "@playwright/test";

const EVENT_ID = "event-1";
const CANDIDATE_ID = "10000000-0000-4000-8000-000000000003";
const ROOM_ID = "10000000-0000-4000-8000-000000000002";

test.describe("成立後チャット（320px）", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "モバイル幅プロジェクトでのみ検証する");
  });

  test("結果から開き、双方同意後に送信し、ブロックで即時停止できる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.route(`**/api/liff/events/${EVENT_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { name: "チャットUAT", participantJourney: [] } }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/result`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            available: true,
            matched: true,
            matchChatEnabled: true,
            matches: [{ matchCandidateId: CANDIDATE_ID, participantNumber: "B01", nickname: "お相手" }],
          },
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/match-chat/rooms`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: ROOM_ID,
            status: "pending_consent",
            opensAt: null,
            closesAt: "2026-08-11T06:00:00.000Z",
            termsVersion: "chat-terms-v1",
            termsBody: "相手を尊重し、安全に利用してください。",
            maxMessageLength: 500,
            participantConsented: false,
          },
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/match-chat/rooms/${ROOM_ID}/consent`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: ROOM_ID,
            status: "open",
            opensAt: "2026-08-08T06:00:00.000Z",
            closesAt: "2026-08-11T06:00:00.000Z",
          },
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/match-chat/rooms/${ROOM_ID}/messages`, async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              messages: [
                { id: "message-1", sender: "match", body: "今日はありがとう", sentAt: "2026-08-08T06:01:00.000Z" },
              ],
            },
          }),
        });
      }
      const body = route.request().postDataJSON() as { body: string };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { id: "message-2", sender: "self", body: body.body, sentAt: "2026-08-08T06:02:00.000Z" },
        }),
      });
    });
    await page.route(`**/api/liff/events/${EVENT_ID}/match-chat/rooms/${ROOM_ID}/block`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { blocked: true } }),
      }),
    );

    await page.goto(`/liff/result?eventId=${EVENT_ID}`);
    await page.getByRole("link", { name: "チャットを開く" }).click();
    await expect(page.getByRole("heading", { name: "チャット利用前の確認" })).toBeVisible();
    await page.getByText("チャット利用規約を確認").click();
    await expect(page.getByText("相手を尊重し、安全に利用してください。")).toBeVisible();
    await page.getByRole("button", { name: "内容に同意してチャットを開始" }).click();
    await expect(page.getByText("今日はありがとう")).toBeVisible();
    await page.getByRole("textbox", { name: "メッセージ", exact: true }).fill("こちらこそありがとう");
    await page.getByRole("button", { name: "送信", exact: true }).click();
    await expect(page.getByText("こちらこそありがとう")).toBeVisible();

    await page.getByRole("button", { name: "安全・通報メニュー" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "このチャットをブロック" }).click();
    await expect(page.getByText("このチャットは停止されています。")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  });
});
