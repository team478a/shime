import { expect, test } from "@playwright/test";

const EVENT_ID = "event-1";
const TARGET_ID = "10000000-0000-4000-8000-000000000001";
const SLOT_ID = "20000000-0000-4000-8000-000000000001";

test.describe("会話メモから最終希望への接続（320px）", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "モバイル幅プロジェクトでのみ検証する");
  });

  test("もう少し話したいを上位候補にするが、本人の確認前には選択・提出しない", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    let wantsToTalkMore = false;
    let revision = 0;
    let savedChoices: Array<{ participantId: string }> = [];

    await page.route(`**/api/liff/events/${EVENT_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { name: "優先導線UAT", participantJourney: [] } }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            enabled: true,
            targetSource: "self_reported",
            options: [{ code: "comfortable", label: "話しやすかった", displayOrder: 1, isNegative: false }],
            targets: [
              {
                interactionSlotId: SLOT_ID,
                targetParticipantId: TARGET_ID,
                participantNumber: "07",
                roundNo: null,
                note:
                  revision === 0
                    ? null
                    : {
                        id: "note-1",
                        interactionSlotId: SLOT_ID,
                        targetParticipantId: TARGET_ID,
                        feelingCode: "comfortable",
                        favorite: false,
                        privateNoteText: "",
                        wantsToTalkMore,
                        revision,
                        savedAt: new Date().toISOString(),
                      },
              },
            ],
          },
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/interaction-memo/${SLOT_ID}/${TARGET_ID}`, async (route) => {
      const body = route.request().postDataJSON() as { wantsToTalkMore: boolean };
      wantsToTalkMore = body.wantsToTalkMore;
      revision += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "note-1",
            interactionSlotId: SLOT_ID,
            targetParticipantId: TARGET_ID,
            feelingCode: "comfortable",
            favorite: false,
            privateNoteText: "",
            wantsToTalkMore,
            revision,
            savedAt: new Date().toISOString(),
          },
        }),
      });
    });
    await page.route(`**/api/liff/events/${EVENT_ID}/preference-options`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            mode: "mutual_up_to_2",
            candidates: [
              { id: TARGET_ID, participantNumber: "07", recommended: wantsToTalkMore },
              { id: "10000000-0000-4000-8000-000000000002", participantNumber: "12", recommended: false },
            ],
            choices: [],
            submissionStatus: "draft",
          },
        }),
      }),
    );
    await page.route(`**/api/liff/events/${EVENT_ID}/preferences`, async (route) => {
      savedChoices = (route.request().postDataJSON() as { choices: Array<{ participantId: string }> }).choices;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
    });
    await page.route(`**/api/liff/events/${EVENT_ID}/preferences/submit`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) }),
    );

    await page.goto(`/liff/interactions?eventId=${EVENT_ID}`);
    const card = page.locator("article.interaction-memo-card");
    await card.getByRole("button", { name: "話しやすかった" }).click();
    await card.getByRole("button", { name: "もう少し話したい", exact: true }).click();
    await page.getByRole("link", { name: "イベント終了時の希望入力へ" }).click();

    await expect(page.getByText("ここではまだ確定していません。", { exact: false })).toBeVisible();
    const candidateCards = page.locator(".participant-choice-grid .emotion-card");
    await expect(candidateCards.nth(0)).toContainText("07");
    await expect(candidateCards.nth(0)).toContainText("♡ もう少し話したい");
    await expect(candidateCards.nth(0)).not.toHaveClass(/selected/);
    expect(savedChoices).toEqual([]);

    await candidateCards.nth(0).getByRole("button", { name: "07" }).click();
    await page.getByRole("button", { name: "この内容で提出" }).click();
    await expect(page.getByText("提出済みです。", { exact: true })).toBeVisible();
    expect(savedChoices).toEqual([{ participantId: TARGET_ID, rank: null, privateNote: null }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  });
});
