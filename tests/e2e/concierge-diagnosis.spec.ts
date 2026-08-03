import { expect, test } from "@playwright/test";

const EVENT_ID = "event-1";

const CARD_IDS = Array.from({ length: 8 }, (_, index) => `1111111${index}-1111-4111-8111-111111111111`);

const QUESTIONS = [
  { axisCode: "axis_1", prompt: "今日はどんな一日でしたか", optionA: "落ち着いていた", optionB: "わくわくしていた" },
  {
    axisCode: "axis_2",
    prompt: "誰かと話すとき大事にしたいことは",
    optionA: "じっくり聞くこと",
    optionB: "率直に伝えること",
  },
  { axisCode: "axis_3", prompt: "休日の過ごし方は", optionA: "静かに過ごす", optionB: "出かけて楽しむ" },
  { axisCode: "axis_4", prompt: "今いちばん大切にしたいものは", optionA: "安心できる関係", optionB: "新しい出会い" },
];

const MARRIAGE_V2_QUESTIONS = [
  { axisCode: "today_feeling", prompt: "今日の気持ち", optionA: "穏やか", optionB: "わくわく" },
  {
    axisCode: "today_priority",
    prompt: "今日大切にしたいこと",
    optionA: "安心して話すこと",
    optionB: "新しい一面を知ること",
  },
  {
    axisCode: "today_expectation",
    prompt: "今日期待していること",
    optionA: "自然な会話",
    optionB: "次につながる出会い",
  },
];

function cardFaces() {
  return CARD_IDS.map((id, index) => ({
    id,
    title: `カードタイトル${index + 1}`,
    message: `カードメッセージ${index + 1}`,
    altText: `カード${index + 1}`,
    emotionCode: `emotion_${index + 1}`,
    displayOrder: index + 1,
    imageUrl: `/api/liff/events/${EVENT_ID}/diagnosis/cards/${id}/image`,
  }));
}

function diagnosisFixture(selectedCardAssetVersionId: string | null, questions = QUESTIONS, schemaVersion: 1 | 2 = 1) {
  const selectedCard = cardFaces().find((card) => card.id === selectedCardAssetVersionId) ?? null;
  return {
    copy: {
      pageTitle: "",
      intro: "",
      instructions: "",
      completionTitle: "",
      completionBody: "",
      startButton: "",
      nextButton: "",
      backButton: "",
      completeButton: "",
    },
    reportCopy: { title: "", heading: "", fixedText: "", disclaimer: "", guidance: "" },
    schemaVersion,
    questions: questions.map((question, index) => ({
      axisCode: question.axisCode,
      prompt: question.prompt,
      supplementalText: "",
      required: true,
      displayOrder: index + 1,
      options: [
        { code: "opt_a", label: question.optionA, displayOrder: 1 },
        { code: "opt_b", label: question.optionB, displayOrder: 2 },
      ],
    })),
    cards: CARD_IDS.map((id, index) => ({ id, displayOrder: index + 1 })),
    selectedCard,
  };
}

async function mockDiagnosisApi(
  page: import("@playwright/test").Page,
  options: { questions?: typeof QUESTIONS; schemaVersion?: 1 | 2 } = {},
) {
  const questions = options.questions ?? QUESTIONS;
  const schemaVersion = options.schemaVersion ?? 1;
  await page.route(`**/api/liff/events/${EVENT_ID}`, async (route) =>
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
          participantJourney: [],
        },
      }),
    }),
  );

  let session: {
    id: string;
    status: "in_progress" | "submitted";
    revision: number;
    selectedCardAssetVersionId: string | null;
    submittedAt: string | null;
  } | null = null;
  let answers: Array<{ axisCode: string; optionCode: string }> = [];
  let result: unknown = null;

  await page.route(`**/api/liff/events/${EVENT_ID}/diagnosis`, async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            diagnosis: diagnosisFixture(session?.selectedCardAssetVersionId ?? null, questions, schemaVersion),
            snapshotHash: "hash",
            access: { opensAt: null, closesAt: null, allowResubmission: false },
            session,
            answers,
            result,
          },
        }),
      });
    }
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as {
        expectedRevision: number;
        selectedCardAssetVersionId: string;
        answers: Array<{ axisCode: string; optionCode: string }>;
      };
      if (!session || body.expectedRevision !== session.revision) {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ code: "DIAGNOSIS_REVISION_CONFLICT" }),
        });
      }
      session = {
        ...session,
        selectedCardAssetVersionId: body.selectedCardAssetVersionId,
        revision: session.revision + 1,
      };
      answers = body.answers;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { revision: session.revision } }),
      });
    }
    return route.continue();
  });

  await page.route(`**/api/liff/events/${EVENT_ID}/diagnosis/start`, async (route) => {
    session = {
      id: "session-1",
      status: "in_progress",
      revision: 0,
      selectedCardAssetVersionId: null,
      submittedAt: null,
    };
    answers = [];
    result = null;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { session } }),
    });
  });

  await page.route(`**/api/liff/events/${EVENT_ID}/diagnosis/submit`, async (route) => {
    if (!session || !session.selectedCardAssetVersionId) {
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ code: "DIAGNOSIS_INCOMPLETE" }),
      });
    }
    const selectedCard = cardFaces().find((card) => card.id === session!.selectedCardAssetVersionId)!;
    result = {
      schemaVersion,
      algorithmVersion: schemaVersion === 2 ? "concierge-rule-v2" : "concierge-rule-v1",
      primaryEmotion: {
        code: selectedCard.emotionCode,
        label: "穏やかな安心感",
        description: "今日はゆったりとした時間を大切にできそうです。",
      },
      card: { assetVersionId: selectedCard.id, title: selectedCard.title, message: selectedCard.message },
      axes: questions.map((question) => {
        const answer = answers.find((item) => item.axisCode === question.axisCode)!;
        return {
          axisCode: question.axisCode,
          prompt: question.prompt,
          optionCode: answer.optionCode,
          optionLabel: answer.optionCode === "opt_a" ? question.optionA : question.optionB,
        };
      }),
      ...(schemaVersion === 2
        ? {
            theme: { code: "opt_a", label: questions[1]!.optionA },
            actionReadiness: { code: "opt_a", label: questions[2]!.optionA },
            supportMessage: selectedCard.message,
          }
        : {}),
    };
    session = { ...session, status: "submitted", submittedAt: new Date().toISOString() };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { result } }),
    });
  });
}

test.describe("SHIME診断（スマートフォン幅）", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "モバイル幅プロジェクトでのみ検証する");
  });

  test("カード選択から4問回答、確認、提出、ルールベース結果表示まで横はみ出しなく完了できる", async ({ page }) => {
    await mockDiagnosisApi(page);
    await page.goto(`/liff/diagnosis?eventId=${EVENT_ID}`);

    await expect(page.getByRole("button", { name: "SHIME診断を始める" })).toBeVisible();
    await page.getByRole("button", { name: "SHIME診断を始める" }).click();

    await expect(page.getByRole("heading", { name: "直感で1枚選んでください" })).toBeVisible();
    await expect(async () => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    }).toPass();
    await page.getByText("カード 1", { exact: true }).click();

    for (const question of QUESTIONS) {
      await expect(page.getByText(question.prompt)).toBeVisible();
      await page.getByLabel(question.optionA).check();
    }
    const overflowOnQuestions = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowOnQuestions).toBe(false);

    await page.getByRole("button", { name: "確認へ進む" }).click();
    await expect(page.getByRole("heading", { name: "回答内容を確認" })).toBeVisible();
    for (const question of QUESTIONS) {
      await expect(page.getByText(question.optionA)).toBeVisible();
    }

    await page.getByRole("button", { name: "この内容で提出" }).click();

    await expect(page.getByRole("heading", { name: "穏やかな安心感" })).toBeVisible();
    // The card position shown in the UI is shuffled per session, so the underlying
    // card identity isn't predictable here; match any of the fixture's card messages.
    await expect(page.getByText(/カードメッセージ\d/)).toBeVisible();
    await expect(
      page.getByText("この結果は自己理解を支援するためのもので、性格・相性・医学的状態を断定するものではありません。"),
    ).toBeVisible();
    for (const question of QUESTIONS) {
      await expect(page.getByText(question.optionA)).toBeVisible();
    }
    const overflowOnResult = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowOnResult).toBe(false);
  });

  test("回答が4問未満のときは確認へ進めない", async ({ page }) => {
    await mockDiagnosisApi(page);
    await page.goto(`/liff/diagnosis?eventId=${EVENT_ID}`);
    await page.getByRole("button", { name: "SHIME診断を始める" }).click();
    await page.getByText("カード 1", { exact: true }).click();

    await page.getByLabel(QUESTIONS[0]!.optionA).check();
    await expect(page.getByRole("button", { name: "確認へ進む" })).toBeDisabled();
  });

  test("marriage_v2は3問回答で確認、提出、結果表示まで完了できる", async ({ page }) => {
    await mockDiagnosisApi(page, { questions: MARRIAGE_V2_QUESTIONS, schemaVersion: 2 });
    await page.goto(`/liff/diagnosis?eventId=${EVENT_ID}`);
    await page.getByRole("button", { name: "SHIME診断を始める" }).click();
    await page.getByText("カード 1", { exact: true }).click();

    for (const question of MARRIAGE_V2_QUESTIONS) {
      const questionGroup = page.getByRole("group", { name: new RegExp(question.prompt) });
      await expect(questionGroup).toBeVisible();
      await questionGroup.getByLabel(question.optionA).check();
    }

    await expect(page.getByRole("button", { name: "確認へ進む" })).toBeEnabled();
    await page.getByRole("button", { name: "確認へ進む" }).click();
    await page.getByRole("button", { name: "この内容で提出" }).click();

    await expect(page.getByRole("heading", { name: "穏やかな安心感" })).toBeVisible();
    await expect(page.getByText("今日のテーマ", { exact: true })).toBeVisible();
    await expect(page.getByText("行動準備度", { exact: true })).toBeVisible();
    await expect(page.getByText(/カードメッセージ\d/)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
