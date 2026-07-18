import type { ReactNode } from "react";
import { AdminPermissionGate } from "@shime/web/components/admin-permission-gate";

export default function CheckinAdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminPermissionGate permission="checkin:write">{children}</AdminPermissionGate>;
}
