export const SEATING_AXES = ["values", "marriage_intent", "relationship_pace", "conversation_style", "topic_overlap"] as const;
export type SeatingAxis = typeof SEATING_AXES[number];
export type AxisAnswer = { declined?: boolean; selections: string[]; ordinal?: number };
export type SeatingAnswers = Partial<Record<SeatingAxis, AxisAnswer>>;

export type ScoringConfig = {
  weights: Record<SeatingAxis, number>;
  maxOrdinalDistance: Partial<Record<SeatingAxis, number>>;
  paceFlexibleCode?: string;
  conversationComplement: Record<string, Record<string, number>>;
};

export type PairScore = { total: number; axes: Partial<Record<SeatingAxis, number>>; normalizedWeights: Partial<Record<SeatingAxis, number>>; sharedTopics: string[] };

const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value)).sort();
const jaccard = (a: string[], b: string[]) => { const union = new Set([...a, ...b]); return union.size ? overlap(a, b).length / union.size : 0; };
const ordinalSimilarity = (a?: number, b?: number, max = 1) => a === undefined || b === undefined ? undefined : Math.max(0, 1 - Math.abs(a - b) / Math.max(1, max));

export function scorePair(a: SeatingAnswers, b: SeatingAnswers, config: ScoringConfig): PairScore {
  const axes: PairScore["axes"] = {};
  const usable = (axis: SeatingAxis) => a[axis] && b[axis] && !a[axis]?.declined && !b[axis]?.declined;
  if (usable("values")) axes.values = jaccard(a.values!.selections, b.values!.selections);
  if (usable("marriage_intent")) { const value = ordinalSimilarity(a.marriage_intent!.ordinal, b.marriage_intent!.ordinal, config.maxOrdinalDistance.marriage_intent); if (value !== undefined) axes.marriage_intent = value; }
  if (usable("relationship_pace")) {
    const flexible = config.paceFlexibleCode && (a.relationship_pace!.selections.includes(config.paceFlexibleCode) || b.relationship_pace!.selections.includes(config.paceFlexibleCode));
    const value = flexible ? 1 : ordinalSimilarity(a.relationship_pace!.ordinal, b.relationship_pace!.ordinal, config.maxOrdinalDistance.relationship_pace); if (value !== undefined) axes.relationship_pace = value;
  }
  if (usable("conversation_style")) {
    const ac = a.conversation_style!.selections[0]; const bc = b.conversation_style!.selections[0];
    axes.conversation_style = ac && bc ? (config.conversationComplement[ac]?.[bc] ?? config.conversationComplement[bc]?.[ac] ?? 0) : 0;
  }
  const sharedTopics = usable("topic_overlap") ? overlap(a.topic_overlap!.selections, b.topic_overlap!.selections) : [];
  if (usable("topic_overlap")) axes.topic_overlap = Math.min(1, sharedTopics.length / Math.max(1, Math.min(a.topic_overlap!.selections.length, b.topic_overlap!.selections.length)));
  const active = SEATING_AXES.filter((axis) => axes[axis] !== undefined);
  const weightTotal = active.reduce((sum, axis) => sum + config.weights[axis], 0);
  const normalizedWeights: PairScore["normalizedWeights"] = {};
  let total = 0;
  for (const axis of active) { const weight = weightTotal ? config.weights[axis] / weightTotal : 0; normalizedWeights[axis] = weight * 100; total += axes[axis]! * weight * 100; }
  return { total: Math.round(total * 100) / 100, axes, normalizedWeights, sharedTopics };
}
