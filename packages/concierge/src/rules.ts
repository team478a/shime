import type { ActiveDiagnosis } from "./snapshot";
import type { DiagnosisAnswer, DiagnosisResultSnapshot } from "./types";

export function createDeterministicDiagnosisResult(input: {
  diagnosis: ActiveDiagnosis;
  snapshotHash: string;
  selectedCardAssetVersionId: string;
  answers: DiagnosisAnswer[];
}): DiagnosisResultSnapshot | null {
  const card = input.diagnosis.cards.find((candidate) => candidate.id === input.selectedCardAssetVersionId);
  if (!card) return null;
  const emotion = input.diagnosis.emotions.find((candidate) => candidate.code === card.emotionCode);
  if (!emotion) return null;
  const answerByAxis = new Map(input.answers.map((answer) => [answer.axisCode, answer.optionCode]));
  const axes = input.diagnosis.questions.flatMap((question) => {
    const optionCode = answerByAxis.get(question.axisCode);
    const option = question.options.find((candidate) => candidate.code === optionCode);
    return optionCode && option
      ? [
          {
            axisCode: question.axisCode,
            prompt: question.prompt,
            optionCode,
            optionLabel: option.label,
          },
        ]
      : [];
  });
  if (axes.length !== input.diagnosis.questions.length) return null;

  const base = {
    snapshotHash: input.snapshotHash,
    primaryEmotion: {
      code: emotion.code,
      label: emotion.label,
      description: emotion.description,
    },
    card: {
      assetVersionId: card.id,
      title: card.title,
      message: card.message,
    },
    axes,
  };

  if (input.diagnosis.schemaVersion === 2) {
    const theme = axes[1];
    const actionReadiness = axes[2];
    if (!theme || !actionReadiness) return null;
    return {
      ...base,
      schemaVersion: 2,
      algorithmVersion: "concierge-rule-v2",
      theme: { code: theme.optionCode, label: theme.optionLabel },
      actionReadiness: { code: actionReadiness.optionCode, label: actionReadiness.optionLabel },
      supportMessage: card.message,
    };
  }

  return {
    ...base,
    schemaVersion: 1,
    algorithmVersion: "concierge-rule-v1",
  };
}
