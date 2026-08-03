import type { LineRichMenuAdminEvent, LineRichMenuDeployment, LineServiceConfig } from "./line-rich-menu-types";

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
}

export interface LineRichMenuImageRenderer {
  render(input: { eventName: string }): Promise<import("./line-rich-menu-types").LineRichMenuImage>;
}
