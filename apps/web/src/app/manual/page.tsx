import type { Metadata } from "next";
import Link from "next/link";

import { MANUALS } from "../../lib/manuals";

export const metadata: Metadata = {
  title: "SHIME® 操作マニュアル",
  description: "SHIME®の参加者用・管理者用操作マニュアル",
};

export default function ManualIndexPage() {
  return (
    <main className="manual-home" id="manual-page-top">
      <section className="manual-home-card">
        <p className="eyebrow">SHIME® GUIDE</p>
        <h1>操作マニュアル</h1>
        <p>ご利用になる立場に合わせてマニュアルを選んでください。</p>
        <div className="manual-card-grid">
          <Link className="manual-card" href="/manual/participant">
            <span>参加者の方</span>
            <strong>{MANUALS.participant.title}</strong>
            <small>{MANUALS.participant.description}</small>
          </Link>
          <Link className="manual-card" href="/admin/manual">
            <span>運営スタッフの方</span>
            <strong>{MANUALS.admin.title}</strong>
            <small>{MANUALS.admin.description}</small>
          </Link>
        </div>
        <p className="manual-note">
          イベントによって利用する機能と順序が異なります。実際の画面と主催者からの案内を優先してください。
        </p>
      </section>
    </main>
  );
}
