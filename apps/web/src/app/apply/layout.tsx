import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell";

export default function ApplyLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell variant="public">{children}</AppShell>;
}
