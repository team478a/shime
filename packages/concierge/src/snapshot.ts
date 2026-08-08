import { z } from "zod";

import { conciergeTemplatePayloadSchema, validateConciergeTemplateForPublish } from "@shime/core";

const snapshotCardSchema = z.object({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  message: z.string(),
  altText: z.string(),
  storageObjectKey: z.string().min(1),
  mimeType: z.string().min(1),
  contentHash: z.string().length(64),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const conciergeEventSnapshotSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    template: conciergeTemplatePayloadSchema,
    cards: z.array(snapshotCardSchema),
  })
  .refine((snapshot) => snapshot.schemaVersion === snapshot.template.schemaVersion, {
    message: "Snapshot and template schema versions must match",
    path: ["schemaVersion"],
  });

export type ConciergeEventSnapshot = z.infer<typeof conciergeEventSnapshotSchema>;
export type ConciergeSnapshotCard = z.infer<typeof snapshotCardSchema>;

export type ActiveDiagnosisCard = ConciergeSnapshotCard & {
  emotionCode: string;
  displayOrder: number;
};

export type ActiveDiagnosis = {
  schemaVersion: ConciergeEventSnapshot["template"]["schemaVersion"];
  copy: ConciergeEventSnapshot["template"]["copy"];
  reportCopy: ConciergeEventSnapshot["template"]["reportCopy"];
  questions: ConciergeEventSnapshot["template"]["questions"];
  emotions: ConciergeEventSnapshot["template"]["emotions"];
  cards: ActiveDiagnosisCard[];
};

export function parseActiveDiagnosis(input: unknown): ActiveDiagnosis | null {
  const parsed = conciergeEventSnapshotSchema.safeParse(input);
  if (!parsed.success || validateConciergeTemplateForPublish(parsed.data.template).length > 0) return null;

  const activeEmotions = parsed.data.template.emotions
    .filter((emotion) => emotion.active)
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const mappings = parsed.data.template.cardMappings
    .filter((mapping) => mapping.active)
    .sort((left, right) => left.displayOrder - right.displayOrder);
  if (
    mappings.length !== 8 ||
    new Set(mappings.map((mapping) => mapping.cardAssetVersionId)).size !== 8 ||
    new Set(mappings.map((mapping) => mapping.emotionCode)).size !== 8
  ) {
    return null;
  }

  const cardsById = new Map(parsed.data.cards.map((card) => [card.id, card]));
  const emotionCodes = new Set(activeEmotions.map((emotion) => emotion.code));
  const cards = mappings.flatMap((mapping) => {
    const card = cardsById.get(mapping.cardAssetVersionId);
    return card && emotionCodes.has(mapping.emotionCode)
      ? [{ ...card, emotionCode: mapping.emotionCode, displayOrder: mapping.displayOrder }]
      : [];
  });
  if (cards.length !== 8) return null;

  return {
    schemaVersion: parsed.data.template.schemaVersion,
    copy: parsed.data.template.copy,
    reportCopy: parsed.data.template.reportCopy,
    questions: [...parsed.data.template.questions].sort((left, right) => left.displayOrder - right.displayOrder),
    emotions: activeEmotions,
    cards,
  };
}
