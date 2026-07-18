import { normalizeName } from "../application/validation";

export type CheckinSearchCandidate = {
  participantNumber: string | null;
  fullName: string;
};

export function normalizeCheckinSearchQuery(value: string): string {
  return value.trim().normalize("NFKC");
}

export function matchesCheckinSearch(candidate: CheckinSearchCandidate, value: string): boolean {
  const query = normalizeCheckinSearchQuery(value);
  if (!query) return false;
  const normalizedNumber = candidate.participantNumber?.normalize("NFKC").toLowerCase() ?? "";
  if (normalizedNumber.startsWith(query.toLowerCase())) return true;
  return normalizeName(candidate.fullName).includes(normalizeName(query));
}
