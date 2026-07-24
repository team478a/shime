export function nextReceptionNumber(currentNumbers: readonly number[]): number {
  return Math.max(0, ...currentNumbers) + 1;
}

export function retainOrAllocateReceptionNumber(
  existingNumber: number | null | undefined,
  currentNumbers: readonly number[],
): number {
  return existingNumber ?? nextReceptionNumber(currentNumbers);
}

export function formatReceptionNumber(
  categoryLabel: string | null | undefined,
  receptionNumber: number | null | undefined,
): string | null {
  if (receptionNumber === null || receptionNumber === undefined) return null;
  return `${categoryLabel ?? ""}${receptionNumber}番`;
}
