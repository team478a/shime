import type { ReactNode } from "react";
import { AdminPermissionGate } from "@shime/web/components/admin-permission-gate";

export default function ResultsAdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminPermissionGate permission="preference:read">{children}</AdminPermissionGate>;
}
