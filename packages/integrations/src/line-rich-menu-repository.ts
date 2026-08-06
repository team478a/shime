import type {
  LineRichMenuAdminEvent,
  LineRichMenuAppearance,
  LineRichMenuDeployment,
  LineRichMenuDraft,
  LineServiceConfig,
} from "./line-rich-menu-types";

export interface LineRichMenuRepository {
  listEvents(tenantId: string): Promise<LineRichMenuAdminEvent[]>;
  findEvent(tenantId: string, eventId: string): Promise<LineRichMenuAdminEvent | null>;
  getLineSettings(tenantId: string): Promise<{ enabled: boolean; config: LineServiceConfig } | null>;
  saveDeployment(input: {
    tenantId: string;
    actorUserId: string;
    requestId: string;
    deployment: LineRichMenuDeployment;
  }): Promise<void>;
  saveDraft(input: {
    tenantId: string;
    actorUserId: string;
    requestId: string;
    appearance: LineRichMenuAppearance;
    updatedAt: string;
  }): Promise<LineRichMenuDraft>;
}

export interface LineRichMenuImageRenderer {
  render(input: {
    eventName: string;
    appearance: LineRichMenuAppearance;
  }): Promise<import("./line-rich-menu-types").LineRichMenuImage>;
}
