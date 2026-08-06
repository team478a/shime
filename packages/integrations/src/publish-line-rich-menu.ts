import { buildLiffEventEntryLink } from "@shime/core";
import type { LineRichMenuProviderFactory } from "./line-rich-menu-provider";
import { LineRichMenuProviderError } from "./line-rich-menu-provider";
import type { LineRichMenuImageRenderer, LineRichMenuRepository } from "./line-rich-menu-repository";
import {
  defaultLineRichMenuAppearance,
  type LineRichMenuAppearance,
  lineRichMenuAppearanceSchema,
  type LineRichMenuDefinition,
} from "./line-rich-menu-types";

export class PublishLineRichMenuError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PublishLineRichMenuError";
  }
}

export class GetLineRichMenuAdminState {
  constructor(private readonly repository: LineRichMenuRepository) {}

  async execute(tenantId: string) {
    const [events, line] = await Promise.all([
      this.repository.listEvents(tenantId),
      this.repository.getLineSettings(tenantId),
    ]);
    return {
      events,
      enabled: line?.enabled ?? false,
      liffConfigured: Boolean(line?.config.liffId),
      current: line?.config.richMenu.current ?? null,
      history: line?.config.richMenu.history ?? [],
      draft: line?.config.richMenu.draft ?? null,
      appearance: line?.config.richMenu.draft?.appearance ?? defaultLineRichMenuAppearance,
    };
  }
}

export class SaveLineRichMenuSettings {
  constructor(
    private readonly repository: LineRichMenuRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: {
    tenantId: string;
    actorUserId: string;
    requestId: string;
    appearance: LineRichMenuAppearance;
  }) {
    const line = await this.repository.getLineSettings(input.tenantId);
    if (!line) throw new PublishLineRichMenuError("LINE_NOT_CONFIGURED");
    return this.repository.saveDraft({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      appearance: lineRichMenuAppearanceSchema.parse(input.appearance),
      updatedAt: this.now().toISOString(),
    });
  }
}

export class PublishLineRichMenu {
  constructor(
    private readonly repository: LineRichMenuRepository,
    private readonly providers: LineRichMenuProviderFactory,
    private readonly imageRenderer: LineRichMenuImageRenderer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { tenantId: string; eventId: string; actorUserId: string; requestId: string }) {
    const [event, line] = await Promise.all([
      this.repository.findEvent(input.tenantId, input.eventId),
      this.repository.getLineSettings(input.tenantId),
    ]);
    if (!event) throw new PublishLineRichMenuError("EVENT_NOT_FOUND");
    if (!line?.enabled) throw new PublishLineRichMenuError("LINE_DISABLED");
    const eventEntryUrl = buildLiffEventEntryLink(line.config.liffId, event.id);
    if (!eventEntryUrl) throw new PublishLineRichMenuError("LIFF_NOT_CONFIGURED");

    const provider = await this.providers.get(input.tenantId).catch(() => {
      throw new PublishLineRichMenuError("LINE_NOT_CONFIGURED");
    });
    const draft = line.config.richMenu.draft;
    const appearance = draft?.appearance ?? defaultLineRichMenuAppearance;
    const definition = this.definition(event.name, eventEntryUrl, appearance);
    const image = await this.imageRenderer.render({ eventName: event.name, appearance }).catch(() => {
      throw new PublishLineRichMenuError("LINE_RICH_MENU_IMAGE_FAILED");
    });
    const previousDefault = await provider.getDefault().catch((error) => this.providerFailure(error));
    await provider.validate(definition).catch((error) => this.providerFailure(error));

    let richMenuId: string | null = null;
    let defaultChanged = false;
    try {
      richMenuId = await provider.create(definition);
      await provider.uploadImage(richMenuId, image);
      await provider.setDefault(richMenuId);
      defaultChanged = true;
      const deployment = {
        richMenuId,
        eventId: event.id,
        eventName: event.name,
        eventEntryUrl,
        appliedAt: this.now().toISOString(),
        appliedBy: input.actorUserId,
        settingsVersion: draft?.version,
        appearance,
      };
      await this.repository.saveDeployment({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        deployment,
      });
      return deployment;
    } catch (error) {
      await this.rollback(provider, richMenuId, previousDefault, defaultChanged);
      if (error instanceof PublishLineRichMenuError) throw error;
      if (error instanceof LineRichMenuProviderError) throw new PublishLineRichMenuError(error.code);
      throw new PublishLineRichMenuError("LINE_RICH_MENU_SAVE_FAILED");
    }
  }

  private definition(
    eventName: string,
    eventEntryUrl: string,
    appearance: LineRichMenuAppearance,
  ): LineRichMenuDefinition {
    return {
      size: { width: 2500, height: 843 },
      selected: true,
      name: appearance.menuNameTemplate.replaceAll("{eventName}", eventName).slice(0, 300),
      chatBarText: appearance.chatBarText,
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 843 },
          action: { type: "uri", uri: eventEntryUrl, label: appearance.actionLabel },
        },
      ],
    };
  }

  private providerFailure(error: unknown): never {
    if (error instanceof LineRichMenuProviderError) throw new PublishLineRichMenuError(error.code);
    throw new PublishLineRichMenuError("LINE_RICH_MENU_UNAVAILABLE");
  }

  private async rollback(
    provider: Awaited<ReturnType<LineRichMenuProviderFactory["get"]>>,
    richMenuId: string | null,
    previous: { source: "messaging_api"; richMenuId: string } | { source: "none_or_manager" },
    defaultChanged: boolean,
  ) {
    if (defaultChanged) {
      await (
        previous.source === "messaging_api" ? provider.setDefault(previous.richMenuId) : provider.clearDefault()
      ).catch(() => undefined);
    }
    if (richMenuId) await provider.delete(richMenuId).catch(() => undefined);
  }
}
