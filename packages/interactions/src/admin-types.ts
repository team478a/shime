import { z } from "zod";
import {
  interactionFeelingCodeSchema,
  interactionPublicProfileFieldKeysSchema,
  interactionTargetSourceSchema,
} from "./types";

export const interactionMemoSnapshotStatusSchema = z.enum(["draft", "published", "stopped"]);

export const interactionMemoDraftOptionSchema = z.object({
  code: interactionFeelingCodeSchema,
  label: z.string().trim().min(1).max(160),
  enabled: z.boolean().default(true),
  isNegative: z.boolean().default(false),
});

export const createInteractionMemoDraftSchema = z.object({
  targetSource: interactionTargetSourceSchema,
  publicProfileFieldKeys: interactionPublicProfileFieldKeysSchema,
  editableUntil: z.iso.datetime({ offset: true }).nullable(),
  options: z.array(interactionMemoDraftOptionSchema).min(1).max(8),
});

export type CreateInteractionMemoDraftInput = z.infer<typeof createInteractionMemoDraftSchema>;

export type InteractionMemoAdminScope = {
  tenantId: string;
  eventId: string;
  serviceType: string;
  actorUserId: string;
  requestId: string;
};

export type InteractionMemoAdminOption = z.infer<typeof interactionMemoDraftOptionSchema> & {
  displayOrder: number;
};

export type InteractionMemoAdminSnapshot = {
  id: string;
  version: number;
  status: z.infer<typeof interactionMemoSnapshotStatusSchema>;
  enabled: boolean;
  targetSource: z.infer<typeof interactionTargetSourceSchema>;
  publicProfileFieldKeys: z.infer<typeof interactionPublicProfileFieldKeysSchema>;
  editableUntil: string | null;
  publishedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
  options: InteractionMemoAdminOption[];
};

export type InteractionMemoAdminWorkspace = {
  snapshots: InteractionMemoAdminSnapshot[];
};
