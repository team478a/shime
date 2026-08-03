import { z } from "zod";

export const lineRichMenuDeploymentSchema = z.object({
  richMenuId: z.string().min(1).max(255),
  eventId: z.string().uuid(),
  eventName: z.string().min(1).max(240),
  eventEntryUrl: z.string().url().max(2000),
  appliedAt: z.string().datetime(),
  appliedBy: z.string().uuid(),
});

export const lineServiceConfigSchema = z
  .object({
    channelId: z.string().max(80).default(""),
    liffId: z.string().max(120).default(""),
    richMenu: z
      .object({
        current: lineRichMenuDeploymentSchema.nullable().default(null),
        history: z.array(lineRichMenuDeploymentSchema).max(10).default([]),
      })
      .default({ current: null, history: [] }),
  })
  .passthrough();

export type LineRichMenuDeployment = z.infer<typeof lineRichMenuDeploymentSchema>;
export type LineServiceConfig = z.infer<typeof lineServiceConfigSchema>;

export type LineRichMenuDefinition = Readonly<{
  size: Readonly<{ width: number; height: number }>;
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: readonly Readonly<{
    bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
    action: Readonly<{ type: "uri"; uri: string; label: string }>;
  }>[];
}>;

export type LineRichMenuImage = Readonly<{
  bytes: Uint8Array;
  mimeType: "image/png";
  width: 2500;
  height: 843;
}>;

export type LineRichMenuAdminEvent = Readonly<{
  id: string;
  name: string;
  status: string;
  startsAt: Date;
}>;
