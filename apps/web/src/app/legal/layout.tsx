import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell";

export default function LegalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell variant="public">{children}</AppShell>;
}
