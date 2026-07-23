import { randomInt } from "node:crypto";
export function isDreamRequirementSatisfied(
  mode: "required_private_allowed" | "optional",
  state: "not_started" | "drafting" | "confirmed" | "skipped",
) {
  return state === "confirmed" || (mode === "optional" && state === "skipped");
}
export function createParticipantNumber(prefix: string, digits: number) {
  if (!/^[A-Z0-9]{1,4}$/.test(prefix) || digits < 2 || digits > 8) throw new Error("Invalid participant number format");
  const max = 10 ** digits;
  return `${prefix}${randomInt(0, max).toString().padStart(digits, "0")}`;
}
export function getParticipantNumberPrefix(
  config: { prefixes?: Record<string, string>; groupAPrefix?: string; groupBPrefix?: string } | undefined,
  category: string,
) {
  return (
    config?.prefixes?.[category] ??
    (category === "group_a" ? config?.groupAPrefix : category === "group_b" ? config?.groupBPrefix : undefined)
  );
}
export function allocateParticipantNumber(
  prefix: string,
  digits: number,
  existingNumbers: ReadonlyArray<string | null>,
) {
  if (!/^[A-Z0-9]{1,4}$/.test(prefix) || digits < 2 || digits > 8) throw new Error("Invalid participant number format");
  const used = new Set(existingNumbers.filter((value): value is string => typeof value === "string"));
  const limit = 10 ** digits;
  for (let sequence = 1; sequence < limit; sequence++) {
    const candidate = `${prefix}${sequence.toString().padStart(digits, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Participant number capacity exhausted");
}
export const QR_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export function formatQrPayload(token: string) {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new Error("Invalid QR token");
  return `SHIME1:${token}`;
}
export function parseQrPayload(value: string) {
  const token = value.startsWith("SHIME1:") ? value.slice(7) : value;
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new Error("Invalid QR payload");
  return token;
}
