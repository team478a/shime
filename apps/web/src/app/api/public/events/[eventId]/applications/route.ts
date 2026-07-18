import { randomUUID } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applicationFieldsSchema, createOpaqueToken, hashIdempotencyKey, LINK_TOKEN_TTL_MS, normalizeEmail, normalizeName, normalizePhone } from "@shime/core";
import { applicationConsents, applications, duplicateCandidates, events, getDatabase, participants } from "@shime/db";
import { getEnv } from "@shime/web/env";

const publicApplicationSchema = applicationFieldsSchema.omit({ externalId: true, status: true, notes: true }).refine((value) => Boolean(value.phone || value.email), { message: "Phone or email is required", path: ["phone"] });
const requestSchema = z.object({ application: publicApplicationSchema, consents: z.array(z.object({ type: z.enum(["event_terms", "privacy"]), documentVersion: z.string().min(1).max(80), accepted: z.literal(true) })).length(2).refine((items) => new Set(items.map((item) => item.type)).size === 2, "Both consent types are required") });
type Context = { params: Promise<{ eventId: string }> };
export async function POST(request: Request, context: Context) {
  const requestId = randomUUID(); const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) return NextResponse.json({ code: "IDEMPOTENCY_KEY_REQUIRED", request_id: requestId }, { status: 400 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", field_errors: parsed.error.flatten().fieldErrors, request_id: requestId }, { status: 400 });
  const { eventId } = await context.params; const db = getDatabase(); const eventRows = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.status, "accepting"))).limit(1); const event = eventRows[0];
  if (!event) return NextResponse.json({ code: "EVENT_NOT_ACCEPTING", request_id: requestId }, { status: 409 });
  const expectedVersions = { event_terms: event.settings.eventTermsVersion, privacy: event.settings.privacyVersion }; if (parsed.data.consents.some((consent) => expectedVersions[consent.type] !== consent.documentVersion)) return NextResponse.json({ code: "CONSENT_VERSION_MISMATCH", request_id: requestId }, { status: 409 });
  const now = new Date(); if ((event.applicationOpensAt && now < event.applicationOpensAt) || (event.applicationClosesAt && now > event.applicationClosesAt)) return NextResponse.json({ code: "APPLICATION_WINDOW_CLOSED", request_id: requestId }, { status: 409 });
  const keyHash = hashIdempotencyKey(idempotencyKey); const existing = await db.select({ id: applications.id }).from(applications).where(and(eq(applications.tenantId, event.tenantId), eq(applications.eventId, event.id), eq(applications.idempotencyKeyHash, keyHash))).limit(1);
  if (existing[0]) { const participantRows = await db.select({ userId: participants.userId }).from(participants).where(and(eq(participants.tenantId, event.tenantId), eq(participants.eventId, event.id), eq(participants.applicationId, existing[0].id))).limit(1); if (participantRows[0]?.userId) return NextResponse.json({ data: { applicationId: existing[0].id, alreadyLinked: true, duplicateSubmission: true }, request_id: requestId }); const replacement = createOpaqueToken(getEnv().LINK_TOKEN_PEPPER); await db.update(participants).set({ linkTokenHash: replacement.tokenHash, linkTokenExpiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MS), linkTokenUsedAt: null, updatedAt: new Date() }).where(and(eq(participants.tenantId, event.tenantId), eq(participants.eventId, event.id), eq(participants.applicationId, existing[0].id), isNull(participants.userId))); return NextResponse.json({ data: { applicationId: existing[0].id, linkToken: replacement.token, duplicateSubmission: true }, request_id: requestId }); }
  const input = parsed.data.application; const phoneNormalized = normalizePhone(input.phone); const emailNormalized = normalizeEmail(input.email);
  const possible = await db.select().from(applications).where(and(eq(applications.tenantId, event.tenantId), eq(applications.eventId, event.id), or(phoneNormalized ? eq(applications.phoneNormalized, phoneNormalized) : undefined, emailNormalized ? eq(applications.emailNormalized, emailNormalized) : undefined)));
  const link = createOpaqueToken(getEnv().LINK_TOKEN_PEPPER); const [created] = await db.transaction(async (tx) => {
    const rows = await tx.insert(applications).values({ tenantId: event.tenantId, eventId: event.id, source: "shime_form", status: "submitted", ...input, phoneNormalized, emailNormalized, idempotencyKeyHash: keyHash, submittedAt: now }).returning(); const row = rows[0]; if (!row) throw new Error("Application creation failed");
    await tx.insert(applicationConsents).values(parsed.data.consents.map((consent) => ({ tenantId: event.tenantId, eventId: event.id, applicationId: row.id, consentType: consent.type, documentVersion: consent.documentVersion, accepted: true, acceptedAt: now })));
    await tx.insert(participants).values({ tenantId: event.tenantId, eventId: event.id, applicationId: row.id, status: "confirmed", linkTokenHash: link.tokenHash, linkTokenExpiresAt: new Date(now.getTime() + LINK_TOKEN_TTL_MS) });
    for (const candidate of possible) { const reasons: string[] = []; if (phoneNormalized && candidate.phoneNormalized === phoneNormalized) reasons.push("phone"); if (emailNormalized && candidate.emailNormalized === emailNormalized) reasons.push("email"); if (normalizeName(candidate.fullName) === normalizeName(input.fullName) && candidate.birthDate === input.birthDate) reasons.push("full_name_and_birth_date"); if (reasons.length) await tx.insert(duplicateCandidates).values({ tenantId: event.tenantId, eventId: event.id, applicationId: row.id, candidateApplicationId: candidate.id, reasons }).onConflictDoNothing(); }
    return rows;
  });
  return NextResponse.json({ data: { applicationId: created?.id, linkToken: link.token }, request_id: requestId }, { status: 201 });
}
