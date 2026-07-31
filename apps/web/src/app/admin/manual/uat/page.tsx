import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ManualDocument } from "../../../../components/manual-document";
import { MANUALS, readManual } from "../../../../lib/manuals";
import { getStaffSession } from "../../../../server/auth";

export const metadata: Metadata = {
  title: `${MANUALS.clientUat.title}｜SHIME®`,
  description: MANUALS.clientUat.description,
  robots: { index: false, follow: false },
};

export default async function ClientUatManualPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  const markdown = await readManual("clientUat");

  return (
    <main className="manual-page" id="manual-page-top">
      <div className="manual-actions">
        <Link className="button-link secondary" href="/admin">
          管理トップへ
        </Link>
        <Link className="button-link secondary" href="/admin/manual">
          管理者マニュアルへ
        </Link>
        <a className="button-link" href={`/downloads/${MANUALS.clientUat.outputName}`} download>
          確認票を保存
        </a>
      </div>
      <ManualDocument markdown={markdown} />
    </main>
  );
}
