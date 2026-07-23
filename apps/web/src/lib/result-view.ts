export type ResultCandidateStatus = "pending" | "approved" | "declined" | string;

export type ResultCandidateSummaryInput = {
  status: ResultCandidateStatus;
};

export function summarizeResultCandidates(candidates: ResultCandidateSummaryInput[]) {
  return candidates.reduce(
    (summary, candidate) => {
      summary.total += 1;
      if (candidate.status === "approved") summary.approved += 1;
      else if (candidate.status === "declined") summary.declined += 1;
      else summary.pending += 1;
      return summary;
    },
    { total: 0, approved: 0, pending: 0, declined: 0 },
  );
}

export function resultStatusClass(status: ResultCandidateStatus) {
  if (status === "approved") return "result-status-approved";
  if (status === "declined") return "result-status-declined";
  return "result-status-pending";
}

export type ResultStatusFilter = "all" | "approved" | "pending" | "declined";
type SearchCandidate = ResultCandidateSummaryInput & { participantAId: string; participantBId: string };
type SearchPerson = { id: string; participantNumber: string | null; fullName: string };

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/g, "");
}

export function filterResultCandidates<T extends SearchCandidate>(
  candidates: T[],
  people: SearchPerson[],
  query: string,
  statusFilter: ResultStatusFilter,
) {
  const personMap = new Map(people.map((person) => [person.id, person]));
  const normalizedQuery = normalizeSearchText(query);
  return candidates.filter((candidate) => {
    const statusGroup =
      candidate.status === "approved" ? "approved" : candidate.status === "declined" ? "declined" : "pending";
    if (statusFilter !== "all" && statusGroup !== statusFilter) return false;
    if (!normalizedQuery) return true;
    return [personMap.get(candidate.participantAId), personMap.get(candidate.participantBId)].some(
      (person) =>
        person &&
        [person.participantNumber ?? "", person.fullName].some((value) =>
          normalizeSearchText(value).includes(normalizedQuery),
        ),
    );
  });
}
