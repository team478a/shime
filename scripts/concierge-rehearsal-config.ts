import {
  conciergeTemplatePayloadSchema,
  type ConciergeTemplatePayload,
  validateConciergeTemplateForPublish,
} from "@shime/core";

export const CONCIERGE_REHEARSAL_TEMPLATE_KEY = "concierge_rehearsal_v1";
export const CONCIERGE_REHEARSAL_TEMPLATE_NAME = "[検証専用] SHIME診断 v1";

export const CONCIERGE_REHEARSAL_CARDS = [
  { code: "calm", label: "落ち着き", description: "自分のペースを大切にできる状態", color: "#6f9f98" },
  { code: "joy", label: "よろこび", description: "明るい気持ちを分かち合いたい状態", color: "#e7a55b" },
  { code: "hope", label: "希望", description: "これからの可能性へ目を向ける状態", color: "#8aa6d6" },
  { code: "curiosity", label: "好奇心", description: "新しいことを知りたい状態", color: "#a489c6" },
  { code: "gratitude", label: "感謝", description: "周りとのつながりを感じる状態", color: "#d99a9a" },
  { code: "courage", label: "勇気", description: "一歩進んでみたい状態", color: "#cc795f" },
  { code: "connection", label: "つながり", description: "相手との関係を育てたい状態", color: "#75a873" },
  { code: "openness", label: "素直さ", description: "今の気持ちをそのまま受け止める状態", color: "#b58f74" },
] as const;

export type ConciergeRehearsalInput = Readonly<{
  apply: boolean;
  eventCode: string;
}>;

export function parseConciergeRehearsalArgs(args: string[]): ConciergeRehearsalInput {
  const apply = args.includes("--apply");
  const eventCodeIndex = args.indexOf("--event-code");
  const eventCode = eventCodeIndex >= 0 ? args[eventCodeIndex + 1] : undefined;
  if (!eventCode || !/^rh-[a-z]-\d{8}$/.test(eventCode)) {
    throw new Error("REHEARSAL_EVENT_CODE_REQUIRED");
  }
  return { apply, eventCode };
}

export function createConciergeRehearsalPayload(cardVersionIds: string[]): ConciergeTemplatePayload {
  if (cardVersionIds.length !== CONCIERGE_REHEARSAL_CARDS.length) {
    throw new Error("EIGHT_CARD_VERSIONS_REQUIRED");
  }
  const payload = conciergeTemplatePayloadSchema.parse({
    schemaVersion: 1,
    copy: {
      pageTitle: "今の気持ちに近いカード",
      intro: "今の自分を入口に、今日大切にしたいことを見つけます。",
      instructions: "8枚のカードから、直感で今の気持ちに近い1枚を選んでください。",
      completionTitle: "今のあなたへのヒント",
      completionBody: "結果はいつでも自分のために振り返ることができます。",
      startButton: "SHIME診断を始める",
      nextButton: "確認へ進む",
      backButton: "回答へ戻る",
      completeButton: "この内容で提出",
    },
    reportCopy: {
      title: "今のあなたへのヒント",
      heading: "",
      fixedText: "正解を決めるものではありません。今の気持ちを知るための手がかりとしてご覧ください。",
      disclaimer: "この結果は自己理解を支援するためのもので、性格・相性・医学的状態を断定するものではありません。",
      guidance: "気になった言葉を、今日の会話のきっかけとしてお使いください。",
    },
    protectedMessageKeys: [
      "auth_required",
      "permission_denied",
      "identity_verification_required",
      "personal_data_notice",
      "system_error",
    ],
    questions: [
      {
        axisCode: "pace",
        prompt: "今の自分に近い過ごし方はどちらですか？",
        supplementalText: "",
        required: true,
        displayOrder: 1,
        options: [
          { code: "quiet", label: "ゆっくり落ち着いて過ごしたい", displayOrder: 1 },
          { code: "active", label: "新しいことを楽しみたい", displayOrder: 2 },
        ],
      },
      {
        axisCode: "conversation",
        prompt: "会話で大切にしたいことはどちらですか？",
        supplementalText: "",
        required: true,
        displayOrder: 2,
        options: [
          { code: "listen", label: "相手の話をじっくり聞くこと", displayOrder: 1 },
          { code: "share", label: "自分の気持ちを率直に伝えること", displayOrder: 2 },
        ],
      },
      {
        axisCode: "connection",
        prompt: "人とのつながりで今求めているものはどちらですか？",
        supplementalText: "",
        required: true,
        displayOrder: 3,
        options: [
          { code: "security", label: "安心して一緒にいられること", displayOrder: 1 },
          { code: "novelty", label: "新しい視点や刺激を得られること", displayOrder: 2 },
        ],
      },
      {
        axisCode: "future",
        prompt: "これから大切にしたい感覚はどちらですか？",
        supplementalText: "",
        required: true,
        displayOrder: 4,
        options: [
          { code: "steady", label: "少しずつ関係を育てること", displayOrder: 1 },
          { code: "chance", label: "可能性を信じて一歩進むこと", displayOrder: 2 },
        ],
      },
    ],
    emotions: CONCIERGE_REHEARSAL_CARDS.map((card, index) => ({
      code: card.code,
      label: card.label,
      description: card.description,
      displayOrder: index + 1,
      active: true,
    })),
    cardMappings: CONCIERGE_REHEARSAL_CARDS.map((card, index) => ({
      cardAssetVersionId: cardVersionIds[index],
      emotionCode: card.code,
      displayOrder: index + 1,
      active: true,
    })),
  });
  const issues = validateConciergeTemplateForPublish(payload);
  if (issues.length) throw new Error(`INVALID_REHEARSAL_TEMPLATE:${issues.map((issue) => issue.code).join(",")}`);
  return payload;
}
