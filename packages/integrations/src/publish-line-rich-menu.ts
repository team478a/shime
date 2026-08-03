import { buildLiffEventEntryLink } from "@shime/core";
import type { LineRichMenuProviderFactory } from "./line-rich-menu-provider";
import { LineRichMenuProviderError } from "./line-rich-menu-provider";
import type { LineRichMenuImageRenderer, LineRichMenuRepository } from "./line-rich-menu-repository";
import type { LineRichMenuDefinition } from "./line-rich-menu-types";

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
    };
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
    const definition = this.definition(event.name, eventEntryUrl);
    const image = await this.imageRenderer.render({ eventName: event.name }).catch(() => {
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

  private definition(eventName: string, eventEntryUrl: string): LineRichMenuDefinition {
    return {
      size: { width: 2500, height: 843 },
      selected: true,
      name: `SHIME ${eventName}`.slice(0, 300),
      chatBarText: "SHIMEを開く",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 843 },
          action: { type: "uri", uri: eventEntryUrl, label: "SHIMEを開く" },
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
