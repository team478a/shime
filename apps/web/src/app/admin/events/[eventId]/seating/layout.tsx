import type { ReactNode } from "react";
import { AdminPermissionGate } from "@shime/web/components/admin-permission-gate";

export default function SeatingAdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminPermissionGate permission="seating:write">{children}</AdminPermissionGate>;
}
