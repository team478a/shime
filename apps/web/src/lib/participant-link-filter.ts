import { matchesCheckinSearch } from "@shime/core/checkin/search";

export type ParticipantLinkFilter = "all" | "linked" | "unlinked";

export type ParticipantLinkFilterRow = {
  participantNumber: string | null;
  fullName: string;
  linked: boolean;
};

export function filterParticipantLinkRows<T extends ParticipantLinkFilterRow>(rows: T[], query: string, filter: ParticipantLinkFilter): T[] {
  const normalizedQuery = query.trim();
  return rows.filter((row) => {
    if (filter === "linked" && !row.linked) return false;
    if (filter === "unlinked" && row.linked) return false;
    return !normalizedQuery || matchesCheckinSearch(row, normalizedQuery);
  });
}
