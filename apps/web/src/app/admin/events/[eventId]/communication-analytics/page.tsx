import { hasPermission } from "@shime/core";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@shime/web/server/auth";
import { CommunicationAnalytics } from "./communication-analytics";

export default async function CommunicationAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "operations:read", session.permissions)) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  return <CommunicationAnalytics eventId={eventId} />;
}
