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
  const notes = new Map<
    string,
    {
      feelingCode: string;
      favorite: boolean;
      privateNoteText: string;
      wantsToTalkMore: boolean;
      revision: number;
      savedAt: string;
    }
  >();
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
          targets: [
            ...Array.from({ length: 8 }, (_, index) => {
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
            {
              interactionSlotId: "30000000-0000-4000-8000-000000000001",
              targetParticipantId: "40000000-0000-4000-8000-000000000001",
              participantNumber: null,
              roundNo: 9,
              note: null,
            },
          ],
        },
      }),
    });
  });
  await page.route(`**/api/liff/events/${EVENT_ID}/interactions/*/profile`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          participantNumber: "B01",
          fields: [
            { key: "nickname", label: "ニックネーム", value: "はな" },
            { key: "age_or_band", label: "年代", value: "30代" },
          ],
        },
      }),
    }),
  );
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
    const body = route.request().postDataJSON() as {
      feelingCode: string;
      favorite: boolean;
      privateNoteText: string;
      wantsToTalkMore: boolean;
      expectedRevision: number;
    };
    const current = notes.get(targetParticipantId);
    const revision = (current?.revision ?? 0) + 1;
    const savedAt = new Date().toISOString();
    notes.set(targetParticipantId, {
      feelingCode: body.feelingCode,
      favorite: body.favorite,
      privateNoteText: body.privateNoteText,
      wantsToTalkMore: body.wantsToTalkMore,
      revision,
      savedAt,
    });
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
          privateNoteText: body.privateNoteText,
          wantsToTalkMore: body.wantsToTalkMore,
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
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("button", { name: new RegExp(`^${index}番`) }) });
      await card.getByRole("button", { name: "安心した" }).click();
      await expect(card.getByText(/保存済み/)).toBeVisible();
    }
    const first = page.locator("article").filter({ has: page.getByRole("button", { name: /^1番/ }) });
    await first.getByRole("button", { name: "楽しかった" }).click();
    await expect(first.getByRole("button", { name: "楽しかった" })).toHaveAttribute("aria-pressed", "true");
    await first.getByRole("button", { name: "☆ お気に入り" }).click();
    await expect(first.getByRole("button", { name: "★ お気に入り" })).toHaveAttribute("aria-pressed", "true");
    await expect(first.getByText(/保存済み/)).toBeVisible();
    await first.getByRole("button", { name: /^1番/ }).click();
    await expect(first.getByText("はな")).toBeVisible();
    await expect(first.getByText("30代")).toBeVisible();
    await first.getByLabel("本人専用メモ（120文字・3行まで）").fill("笑顔が印象的");
    await first.getByRole("button", { name: "メモを保存" }).click();
    await expect(first.getByText(/保存済み/)).toBeVisible();
    await first.getByRole("button", { name: "もう少し話したい", exact: true }).click();
    await expect(first.getByRole("button", { name: "✓ もう少し話したいに保存しました" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
    await expect(page.getByText("参加者氏名")).toHaveCount(0);
    await expect(page.getByText("example@example.com")).toHaveCount(0);
    await expect(page.getByText("番号確認中")).toHaveCount(0);
  });

  test("通信失敗後も選択を保持し、同じカードから再試行できる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mockInteractionMemo(page, true);
    await page.goto(`/liff/interactions?eventId=${EVENT_ID}`);

    const first = page.locator("article").filter({ has: page.getByRole("button", { name: /^1番/ }) });
    await first.getByRole("button", { name: "安心した" }).click();
    await expect(first.getByText("保存できませんでした。通信状態を確認して再試行してください。")).toBeVisible();
    await expect(first.getByRole("button", { name: "安心した" })).toHaveAttribute("aria-pressed", "true");
    await first.getByRole("button", { name: "再試行" }).click();
    await expect(first.getByText(/保存済み/)).toBeVisible();
  });

  test("立食で番号前方一致から明示確認し、メモ入力前だけ誤登録を取り消せる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    let target: Record<string, unknown> | null = null;
    await page.route(`**/api/liff/events/${EVENT_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { name: "立食UAT", participantJourney: [] } }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            enabled: true,
            snapshotVersion: 1,
            targetSource: "self_reported",
            options,
            targets: target ? [target] : [],
          },
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo/target-candidates?*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { targetParticipantId: "40000000-0000-4000-8000-000000000001", participantNumber: "B03" },
            { targetParticipantId: "40000000-0000-4000-8000-000000000002", participantNumber: "B04" },
          ],
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo/slots`, async (route) => {
      target = {
        interactionSlotId: "30000000-0000-4000-8000-000000000001",
        targetParticipantId: "40000000-0000-4000-8000-000000000001",
        participantNumber: "B03",
        roundNo: null,
        note: null,
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: target }) });
    });
    await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo/slots/*/*`, (route) => {
      target = null;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
    });

    await page.goto(`/liff/interactions?eventId=${EVENT_ID}`);
    await page.getByLabel("番号で絞り込む（任意）").fill("3");
    await page.getByRole("button", { name: "一覧を更新" }).click();
    await expect(page.getByRole("button", { name: "3" })).toBeVisible();
    await expect(page.getByText("参加者氏名")).toHaveCount(0);
    await page.getByRole("button", { name: "3" }).click();
    await expect(page.getByText("3番でよいですか？")).toBeVisible();
    await page.getByRole("button", { name: "この番号でよい" }).click();
    await expect(page.getByRole("button", { name: /^3番/ })).toBeVisible();
    await page.getByRole("button", { name: "誤登録を取り消す" }).click();
    await expect(page.getByRole("button", { name: /^3番/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  });
});
