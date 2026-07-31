import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell";

export default function ManualLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppShell variant="public">
      <nav className="manual-primary-nav" aria-label="操作マニュアル">
        <div>
          <Link href="/manual">マニュアル一覧</Link>
          <Link href="/manual/participant">参加者用</Link>
          <Link href="/admin/manual">管理者用</Link>
        </div>
      </nav>
      {children}
    </AppShell>
  );
}
