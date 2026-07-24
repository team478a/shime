"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@shime/core";
import { participantJourneyStepsSchema } from "@shime/event-core";
import { getStaffSession } from "@shime/web/server/auth";
import { publishParticipantJourneyDraft, saveParticipantJourneyDraft } from "@shime/web/server/event-journey-use-cases";

async function getAuthorizedSession(eventId: string) {
  const session = await getStaffSession();
  if (!session || !hasPermission(session.role, "event:write") || (session.eventId && session.eventId !== eventId)) {
    return null;
  }
  return session;
}

function parseSteps(formData: FormData) {
  const raw = String(formData.get("steps") ?? "");
  return participantJourneyStepsSchema.parse(JSON.parse(raw));
}

export async function saveJourneyAction(eventId: string, formData: FormData) {
  const session = await getAuthorizedSession(eventId);
  if (!session) redirect("/admin/login");
  await saveParticipantJourneyDraft.execute({
    tenantId: session.tenantId,
    eventId,
    actorUserId: session.userId,
    requestId: randomUUID(),
    steps: parseSteps(formData),
    now: new Date(),
  });
  revalidatePath(`/admin/events/${eventId}/journey`);
  redirect(`/admin/events/${eventId}/journey?status=saved`);
}

export async function publishJourneyAction(eventId: string, formData: FormData) {
  const session = await getAuthorizedSession(eventId);
  if (!session) redirect("/admin/login");
  const requestId = randomUUID();
  await saveParticipantJourneyDraft.execute({
    tenantId: session.tenantId,
    eventId,
    actorUserId: session.userId,
    requestId,
    steps: parseSteps(formData),
    now: new Date(),
  });
  await publishParticipantJourneyDraft.execute({
    tenantId: session.tenantId,
    eventId,
    actorUserId: session.userId,
    requestId,
    now: new Date(),
  });
  revalidatePath(`/admin/events/${eventId}/journey`);
  redirect(`/admin/events/${eventId}/journey?status=published`);
}
