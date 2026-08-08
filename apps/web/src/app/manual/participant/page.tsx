import type { Metadata } from "next";
import Link from "next/link";

import { ManualDocument } from "../../../components/manual-document";
import { MANUALS, readManual } from "../../../lib/manuals";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `${MANUALS.participant.title}｜SHIME®`,
  description: MANUALS.participant.description,
};

export default async function ParticipantManualPage() {
  const markdown = await readManual("participant");
  return (
    <main className="manual-page" id="manual-page-top">
      <div className="manual-actions">
        <Link className="button-link secondary" href="/manual">
          マニュアル一覧へ
        </Link>
        <a className="button-link" href={`/downloads/${MANUALS.participant.outputName}`} download>
          Markdown版を保存
        </a>
      </div>
      <ManualDocument markdown={markdown} />
    </main>
  );
}
