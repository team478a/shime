import { hasPermission } from "@shime/core";
import { redirect } from "next/navigation";
import { getStaffSession } from "../../../../server/auth";
import { EventSettingsForm } from "../event-settings-form";

export default async function NewEventPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  return <main><section className="panel settings-panel"><p className="eyebrow">EVENT SETTINGS</p><h1>イベントを作成</h1><p>未確定項目は空欄のまま下書き保存できます。日時は日本時間で入力してください。</p><EventSettingsForm mode="create" /></section></main>;
}
