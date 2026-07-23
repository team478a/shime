export type QuestionnaireAnswer = {
  questionId: string;
  optionCodes: string[];
  declined: boolean;
};

export function isQuestionnaireComplete(
  questionIds: readonly string[],
  answers: Readonly<Record<string, QuestionnaireAnswer>>,
): boolean {
  return (
    questionIds.length > 0 &&
    questionIds.every((questionId) => {
      const answer = answers[questionId];
      return Boolean(answer && (answer.declined || answer.optionCodes.length > 0));
    })
  );
}
