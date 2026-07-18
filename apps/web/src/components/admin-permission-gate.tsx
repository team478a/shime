import type { Permission } from "@shime/core";
import { hasPermission } from "@shime/core";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getStaffSession } from "../server/auth";

export async function AdminPermissionGate({
  children,
  permission,
}: Readonly<{
  children: ReactNode;
  permission: Permission;
}>) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, permission)) redirect("/admin");
  return children;
}
