import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell";

export default function LiffLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppShell variant="participant">{children}</AppShell>;
}
