import type { ReactNode } from "react";

import { AdminPrimaryNavigation } from "../../components/admin-navigation";
import { AppShell } from "../../components/app-shell";
import { getAdminPrimaryNavigation } from "../../lib/admin-navigation";
import { getStaffSession } from "../../server/auth";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getStaffSession();

  return (
    <AppShell variant="admin">
      {session && <AdminPrimaryNavigation items={getAdminPrimaryNavigation(session.role, Boolean(session.eventId))} />}
      {children}
    </AppShell>
  );
}
