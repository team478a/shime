import { z } from "zod";

const richMenuImageText = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Z0-9 ]+$/, "画像内文言は半角英大文字・数字・空白で入力してください");

const hexColor = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, "色は#RRGGBB形式で入力してください")
  .transform((value) => value.toUpperCase());

export const lineRichMenuAppearanceSchema = z.object({
  menuNameTemplate: z.string().trim().min(1).max(300).default("SHIME {eventName}"),
  chatBarText: z.string().trim().min(1).max(14).default("SHIMEを開く"),
  actionLabel: z.string().trim().min(1).max(20).default("SHIMEを開く"),
  title: richMenuImageText.default("SHIME"),
  headline: richMenuImageText.default("OPEN"),
  buttonText: richMenuImageText.max(10).default("TAP"),
  backgroundColor: hexColor.default("#FFF8F7"),
  panelColor: hexColor.default("#FFFFFF"),
  accentColor: hexColor.default("#BF4C68"),
  textColor: hexColor.default("#2D2A2C"),
});

export const defaultLineRichMenuAppearance = lineRichMenuAppearanceSchema.parse({});

export const lineRichMenuDraftSchema = z.object({
  version: z.number().int().positive(),
  appearance: lineRichMenuAppearanceSchema,
  updatedAt: z.string().datetime(),
  updatedBy: z.string().uuid(),
});

export const lineRichMenuDeploymentSchema = z.object({
  richMenuId: z.string().min(1).max(255),
  eventId: z.string().uuid(),
  eventName: z.string().min(1).max(240),
  eventEntryUrl: z.string().url().max(2000),
  appliedAt: z.string().datetime(),
  appliedBy: z.string().uuid(),
  settingsVersion: z.number().int().positive().optional(),
  appearance: lineRichMenuAppearanceSchema.optional(),
});

export const lineServiceConfigSchema = z
  .object({
    channelId: z.string().max(80).default(""),
    liffId: z.string().max(120).default(""),
    richMenu: z
      .object({
        current: lineRichMenuDeploymentSchema.nullable().default(null),
        history: z.array(lineRichMenuDeploymentSchema).max(10).default([]),
        draft: lineRichMenuDraftSchema.nullable().default(null),
      })
      .default({ current: null, history: [], draft: null }),
  })
  .passthrough();

export type LineRichMenuDeployment = z.infer<typeof lineRichMenuDeploymentSchema>;
export type LineRichMenuAppearance = z.infer<typeof lineRichMenuAppearanceSchema>;
export type LineRichMenuDraft = z.infer<typeof lineRichMenuDraftSchema>;
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
