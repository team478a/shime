import { redirect } from "next/navigation";
import { hasPermission } from "@shime/core";
import { requireStaffSession } from "@shime/web/server/auth";
const exports = [
  { type: "participants", label: "参加者一覧" },
  { type: "checkins", label: "受付一覧" },
  { type: "seats", label: "公開済み席表" },
  { type: "progress", label: "進捗一覧" },
  { type: "results", label: "確定結果" },
];
export default async function ExportsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "backup:export")) redirect("/admin");
  const { eventId } = await params;
  return (
    <main>
      <section className="panel admin-panel">
        <p className="eyebrow">BACKUP</p>
        <h1>CSVバックアップ</h1>
        <p>Excelで開けるUTF-8 CSVです。出力操作は監査ログへ記録されます。</p>
        <div className="actions">
          {exports.map((item) => (
            <a className="button-link" key={item.type} href={`/api/admin/events/${eventId}/exports/${item.type}`}>
              {item.label}
            </a>
          ))}
        </div>
        {hasPermission(session.role, "backup:sensitive") && (
          <section>
            <h2>責任者限定</h2>
            <p>一方希望、順位、非公開メモを含みます。取扱いに注意してください。</p>
            <a className="button-link secondary" href={`/api/admin/events/${eventId}/exports/preferences`}>
              希望詳細
            </a>
          </section>
        )}
      </section>
    </main>
  );
}
