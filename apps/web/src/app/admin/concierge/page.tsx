import { and, desc, eq } from "drizzle-orm";
import { hasPermission, CONCIERGE_MODULE_KEY, conciergeTemplatePayloadSchema } from "@shime/core";
import {
  conciergeCardAssets,
  conciergeCardAssetVersions,
  conciergeTemplates,
  conciergeTemplateVersions,
  getDatabase,
} from "@shime/db";
import { redirect } from "next/navigation";
import { getStaffSession } from "../../../server/auth";
import { ConciergeAdminConsole, type ConciergeAdminCard, type ConciergeAdminTemplate } from "./concierge-admin-console";

export default async function ConciergeAdminPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "concierge:manage") || session.eventId) redirect("/admin");
  const db = getDatabase();
  const [templateRows, versionRows, assetRows, cardVersionRows] = await Promise.all([
    db
      .select()
      .from(conciergeTemplates)
      .where(
        and(eq(conciergeTemplates.tenantId, session.tenantId), eq(conciergeTemplates.moduleKey, CONCIERGE_MODULE_KEY)),
      )
      .orderBy(desc(conciergeTemplates.updatedAt)),
    db
      .select()
      .from(conciergeTemplateVersions)
      .where(eq(conciergeTemplateVersions.tenantId, session.tenantId))
      .orderBy(desc(conciergeTemplateVersions.version)),
    db
      .select()
      .from(conciergeCardAssets)
      .where(
        and(
          eq(conciergeCardAssets.tenantId, session.tenantId),
          eq(conciergeCardAssets.moduleKey, CONCIERGE_MODULE_KEY),
        ),
      )
      .orderBy(desc(conciergeCardAssets.updatedAt)),
    db
      .select()
      .from(conciergeCardAssetVersions)
      .where(eq(conciergeCardAssetVersions.tenantId, session.tenantId))
      .orderBy(desc(conciergeCardAssetVersions.version)),
  ]);
  const templates: ConciergeAdminTemplate[] = templateRows.map((template) => ({
    id: template.id,
    name: template.name,
    versions: versionRows
      .filter((version) => version.templateId === template.id)
      .flatMap((version) => {
        const payload = conciergeTemplatePayloadSchema.safeParse(version.payload);
        return payload.success
          ? [
              {
                id: version.id,
                version: version.version,
                status: version.status,
                payload: payload.data,
              },
            ]
          : [];
      }),
  }));
  const cards: ConciergeAdminCard[] = assetRows.map((asset) => ({
    id: asset.id,
    code: asset.code,
    name: asset.name,
    versions: cardVersionRows
      .filter((version) => version.assetId === asset.id)
      .map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status,
        title: version.title,
        message: version.message,
        altText: version.altText,
        width: version.width,
        height: version.height,
      })),
  }));
  return (
    <main>
      <ConciergeAdminConsole
        initialTemplates={templates}
        initialCards={cards}
        canPublish={hasPermission(session.role, "concierge:publish")}
      />
    </main>
  );
}
