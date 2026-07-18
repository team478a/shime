import type { ReactNode } from "react";
import { AdminPermissionGate } from "@shime/web/components/admin-permission-gate";

export default function QuestionnaireAdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminPermissionGate permission="event:write">{children}</AdminPermissionGate>;
}
