import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { events, getDatabase } from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
import { SeatingConsole } from "./seating-console";

export default async function SeatingPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireStaffSession().catch(() => null);
  if (!session) redirect("/admin/login");
  const { eventId } = await params;
  const event = (
    await getDatabase()
      .select({ name: events.name })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1)
  )[0];
  if (!event) notFound();
  return (
    <main>
      <section className="panel admin-panel">
        <p className="eyebrow">SEATING OPERATIONS</p>
        <h1>席配置</h1>
        <p>受付済み参加者だけを対象に決定論的な配置案を作成します。公開操作は運営責任者だけが実行できます。</p>
        <SeatingConsole
          eventId={eventId}
          eventName={event.name}
          canPublish={session.role === "manager" || session.role === "system_admin"}
        />
      </section>
    </main>
  );
}
