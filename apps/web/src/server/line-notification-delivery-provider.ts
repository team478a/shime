import type { NotificationDeliveryProvider } from "@shime/notifications";
import { getLineProvider } from "./line-provider";

export class LineNotificationDeliveryProvider implements NotificationDeliveryProvider {
  async sendText(tenantId: string, lineUserId: string, text: string) {
    return (await getLineProvider(tenantId)).sendPush(lineUserId, [{ type: "text", text }]);
  }
}
