export const QUESTIONNAIRE_AXES = [
  "values",
  "marriage_intent",
  "relationship_pace",
  "conversation_style",
  "topic_overlap",
] as const;
export type QuestionnaireAxis = (typeof QUESTIONNAIRE_AXES)[number];
export type QuestionnaireKind = "multi_select" | "ordinal" | "complement";
export type QuestionnaireOptionDraft = { code: string; label: string; scoreValue: number | null };
export type QuestionnaireQuestionDraft = {
  axis: QuestionnaireAxis;
  prompt: string;
  kind: QuestionnaireKind;
  maxSelections: number;
  weight: number;
  options: QuestionnaireOptionDraft[];
};

export const AXIS_LABELS: Record<QuestionnaireAxis, string> = {
  values: "価値観",
  marriage_intent: "結婚意向",
  relationship_pace: "関係のペース",
  conversation_style: "会話スタイル",
  topic_overlap: "共通テーマ",
};

export function questionnaireEditorIssues(questions: QuestionnaireQuestionDraft[]) {
  const issues: string[] = [];
  if (questions.length !== 5 || new Set(questions.map((question) => question.axis)).size !== 5)
    issues.push("5つの軸を1問ずつ設定してください。");
  const totalWeight = questions.reduce((sum, question) => sum + question.weight, 0);
  if (totalWeight !== 100) issues.push(`重みの合計を100にしてください（現在 ${totalWeight}）。`);
  questions.forEach((question, index) => {
    const label = `${index + 1}問目`;
    if (!question.prompt.trim()) issues.push(`${label}の質問文を入力してください。`);
    if (question.options.length < 2) issues.push(`${label}の選択肢を2件以上設定してください。`);
    const codes = question.options.map((option) => option.code.trim()).filter(Boolean);
    if (codes.length !== question.options.length || question.options.some((option) => !option.label.trim()))
      issues.push(`${label}の選択肢コードと表示名を入力してください。`);
    if (new Set(codes).size !== codes.length) issues.push(`${label}の選択肢コードが重複しています。`);
    if (question.maxSelections < 1 || question.maxSelections > question.options.length)
      issues.push(`${label}の最大選択数を選択肢数以下にしてください。`);
  });
  return [...new Set(issues)];
}
