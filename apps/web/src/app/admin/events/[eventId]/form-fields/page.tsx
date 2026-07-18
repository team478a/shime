import { and, asc, desc, eq } from "drizzle-orm";
import { eventFormFields, getDatabase, resourceTemplates } from "@shime/db";
import { APPLICATION_FORM_TEMPLATE_TYPE, applicationFormTemplatePayloadSchema, EVENT_CONFIGURATION_MODULE_KEY, hasPermission } from "@shime/core";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "../../../../../server/auth";
import { FormFieldSettings } from "./form-field-settings";

export default async function FormFieldsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession(); if (!session) redirect("/admin/login"); if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params; if (session.eventId && session.eventId !== eventId) notFound();
  const db = getDatabase();
  const fields = await db.select().from(eventFormFields).where(and(eq(eventFormFields.tenantId, session.tenantId), eq(eventFormFields.eventId, eventId))).orderBy(asc(eventFormFields.displayOrder));
  const templateRows = await db.select().from(resourceTemplates).where(and(eq(resourceTemplates.tenantId, session.tenantId), eq(resourceTemplates.moduleKey, EVENT_CONFIGURATION_MODULE_KEY), eq(resourceTemplates.templateType, APPLICATION_FORM_TEMPLATE_TYPE), eq(resourceTemplates.active, true))).orderBy(desc(resourceTemplates.updatedAt));
  const templates = templateRows.flatMap((template) => { const payload = applicationFormTemplatePayloadSchema.safeParse(template.payload); return payload.success ? [{ id: template.id, name: template.name, version: template.version, rows: payload.data.fields.map((field) => ({ fieldKey: field.fieldKey, label: field.label, type: field.type, requirement: field.requirement, displayOrder: field.displayOrder, options: Array.isArray(field.validation.options) ? field.validation.options.filter((option): option is string => typeof option === "string").join(", ") : "" })) }] : []; });
  return <main><FormFieldSettings eventId={eventId} initial={fields.map((field) => ({ fieldKey: field.fieldKey, label: field.label, type: field.type, requirement: field.requirement, displayOrder: field.displayOrder, options: Array.isArray(field.validation.options) ? field.validation.options.join(", ") : "" }))} templates={templates} canManageTemplates={!session.eventId} /></main>;
}
