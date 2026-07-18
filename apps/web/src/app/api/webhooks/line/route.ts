import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhookSignature } from "@shime/core";
import { getDatabase, lineWebhookEvents, tenants } from "@shime/db";
import { getLineWebhookSecret } from "@shime/web/server/line-provider";

const envSchema = z.object({ SESSION_PEPPER: z.string().min(32) });
const bodySchema = z.object({ events: z.array(z.object({ webhookEventId: z.string().min(1), type: z.string().min(1), timestamp: z.number().optional(), source: z.object({ userId: z.string().optional() }).optional() }).passthrough()) });
export async function POST(request: Request) {
  const raw = await request.text(); const tenantCode = new URL(request.url).searchParams.get("tenant"); if (!tenantCode) return NextResponse.json({ code: "TENANT_REQUIRED" }, { status: 400 });
  const db = getDatabase(); const tenant = (await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.code, tenantCode)).limit(1))[0]; if (!tenant) return NextResponse.json({ code: "TENANT_NOT_FOUND" }, { status: 404 });
  let secret: string; try { secret = await getLineWebhookSecret(tenant.id); } catch { return NextResponse.json({ code: "LINE_NOT_CONFIGURED" }, { status: 503 }); }
  if (!verifyWebhookSignature(raw, request.headers.get("x-line-signature"), secret)) return NextResponse.json({ code: "INVALID_SIGNATURE" }, { status: 401 });
  let json: unknown; try { json = JSON.parse(raw); } catch { return NextResponse.json({ code: "INVALID_BODY" }, { status: 400 }); } const parsed = bodySchema.safeParse(json); if (!parsed.success) return NextResponse.json({ code: "INVALID_BODY" }, { status: 400 }); const env = envSchema.parse(process.env);
  for (const event of parsed.data.events) { const lineUserIdHash = event.source?.userId ? createHash("sha256").update(`${event.source.userId}\u0000${env.SESSION_PEPPER}`).digest("hex") : null; await db.insert(lineWebhookEvents).values({ tenantId: tenant.id, webhookEventId: event.webhookEventId, eventType: event.type, lineUserIdHash, status: "processed", occurredAt: event.timestamp ? new Date(event.timestamp) : null, processedAt: new Date() }).onConflictDoNothing(); }
  return NextResponse.json({ ok: true });
}
