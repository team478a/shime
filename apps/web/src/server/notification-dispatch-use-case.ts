import { createDrizzleNotificationRepository, DispatchNotifications } from "@shime/notifications";
import { LineNotificationDeliveryProvider } from "./line-notification-delivery-provider";
import { notificationFailureCode } from "./operational-security";

export const dispatchNotifications = new DispatchNotifications(
  createDrizzleNotificationRepository(),
  new LineNotificationDeliveryProvider(),
  notificationFailureCode,
);
