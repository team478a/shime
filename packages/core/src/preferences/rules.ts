export type PreferenceMode = "mutual_up_to_2" | "first_choice_only" | "ranked_up_to_3";
export type PreferenceChoice = { participantId: string; rank?: number | null; privateNote?: string | null };
export type PreferenceEdge = { fromParticipantId: string; toParticipantId: string; rank: number | null };
export type MutualCandidate = {
  participantAId: string;
  participantBId: string;
  aRank: number | null;
  bRank: number | null;
};
export function validatePreferenceChoices(mode: PreferenceMode, choices: PreferenceChoice[]): void {
  const max = mode === "ranked_up_to_3" ? 3 : mode === "mutual_up_to_2" ? 2 : 1;
  if (choices.length > max) throw new Error("TOO_MANY_CHOICES");
  if (new Set(choices.map((c) => c.participantId)).size !== choices.length) throw new Error("DUPLICATE_PARTICIPANT");
  if (choices.some((c) => (c.privateNote?.length ?? 0) > 1000)) throw new Error("NOTE_TOO_LONG");
  if (mode === "ranked_up_to_3") {
    const ranks = choices.map((c) => c.rank);
    if (
      ranks.some((rank) => !Number.isInteger(rank) || rank! < 1 || rank! > choices.length) ||
      new Set(ranks).size !== ranks.length
    )
      throw new Error("INVALID_RANKS");
  } else if (choices.some((c) => c.rank != null)) throw new Error("RANK_NOT_ALLOWED");
}
export function detectMutualCandidates(edges: PreferenceEdge[]): MutualCandidate[] {
  const byDirection = new Map(edges.map((edge) => [`${edge.fromParticipantId}:${edge.toParticipantId}`, edge]));
  const result: MutualCandidate[] = [];
  for (const edge of [...edges].sort((a, b) =>
    `${a.fromParticipantId}:${a.toParticipantId}`.localeCompare(`${b.fromParticipantId}:${b.toParticipantId}`),
  )) {
    const reverse = byDirection.get(`${edge.toParticipantId}:${edge.fromParticipantId}`);
    if (!reverse || edge.fromParticipantId.localeCompare(edge.toParticipantId) >= 0) continue;
    result.push({
      participantAId: edge.fromParticipantId,
      participantBId: edge.toParticipantId,
      aRank: edge.rank,
      bRank: reverse.rank,
    });
  }
  return result;
}
export function findMatchConflicts(
  candidates: Array<{ id: string; participantAId: string; participantBId: string; status: string }>,
  allowMultiple: boolean,
): string[][] {
  if (allowMultiple) return [];
  const byParticipant = new Map<string, string[]>();
  for (const candidate of candidates.filter((c) => c.status === "approved"))
    for (const id of [candidate.participantAId, candidate.participantBId])
      byParticipant.set(id, [...(byParticipant.get(id) ?? []), candidate.id]);
  return [...byParticipant.values()].filter((ids) => ids.length > 1);
}
