import { hasPermission } from "@shime/core";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@shime/web/server/auth";
import { MatchChatSettings } from "./match-chat-settings";

export default async function MatchChatSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write", session.permissions)) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  return <MatchChatSettings eventId={eventId} />;
}
