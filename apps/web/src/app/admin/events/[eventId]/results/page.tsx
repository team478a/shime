import { redirect } from "next/navigation";
import { hasPermission } from "@shime/core";
import { requireStaffSession } from "@shime/web/server/auth";
import { ResultsConsole } from "./results-console";
export default async function ResultsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) redirect("/admin/login");
  const { eventId } = await params;
  return (
    <main>
      <section className="panel admin-panel">
        <p className="eyebrow">PHASE 7</p>
        <h1>希望・結果確定</h1>
        <ResultsConsole
          eventId={eventId}
          canDecide={hasPermission(session.role, "result:confirm", session.permissions)}
          canRevoke={hasPermission(session.role, "result:revoke", session.permissions)}
        />
      </section>
    </main>
  );
}
