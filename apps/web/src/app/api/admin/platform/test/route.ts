import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase, tenantOperationalSettings, tenantServiceSettings } from "@shime/db";
import { requireStaffSession } from "../../../../../server/auth";
import { decryptSecrets } from "../../../../../server/secret-store";

const input = z.object({ target: z.enum(["line", "openai", "health", "domain"]) });
async function probe(url: string, init?: RequestInit) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000); try { const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" }); return { ok: response.ok, status: response.status, code: response.ok ? "OK" : `HTTP_${response.status}` }; } catch (error) { return { ok: false, status: 0, code: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "CONNECTION_FAILED" }; } finally { clearTimeout(timer); } }

export async function POST(request: Request) {
  const session = await requireStaffSession().catch(() => null); if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }); if (session.role !== "system_admin") return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }); const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const db = getDatabase(); const target = parsed.data.target; let result: { ok: boolean; status: number; code: string };
  if (target === "line" || target === "openai") {
    const setting = (await db.select().from(tenantServiceSettings).where(and(eq(tenantServiceSettings.tenantId, session.tenantId), eq(tenantServiceSettings.serviceKey, target))).limit(1))[0];
    let secrets: Record<string, string> = {}; try { if (setting?.encryptedSecrets) secrets = decryptSecrets(setting.encryptedSecrets); } catch { return NextResponse.json({ code: "SECRET_DECRYPTION_FAILED" }, { status: 500 }); }
    if (target === "line") { const token = secrets.accessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN; result = token ? await probe("https://api.line.me/v2/bot/info", { headers: { Authorization: `Bearer ${token}` } }) : { ok: false, status: 0, code: "CREDENTIAL_MISSING" }; }
    else { const apiKey = secrets.apiKey ?? process.env.OPENAI_API_KEY; result = apiKey ? await probe("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } }) : { ok: false, status: 0, code: "CREDENTIAL_MISSING" }; }
    await db.update(tenantServiceSettings).set({ lastCheckedAt: new Date(), lastCheckStatus: result.ok ? "healthy" : "failed", lastCheckCode: result.code, updatedAt: new Date() }).where(and(eq(tenantServiceSettings.tenantId, session.tenantId), eq(tenantServiceSettings.serviceKey, target)));
  } else {
    const operations = (await db.select().from(tenantOperationalSettings).where(eq(tenantOperationalSettings.tenantId, session.tenantId)).limit(1))[0];
    const url = target === "domain" ? operations?.customDomain ? `https://${operations.customDomain}/api/health` : null : operations?.healthcheckUrl ?? `${process.env.APP_URL}/api/health`;
    result = url ? await probe(url) : { ok: false, status: 0, code: "URL_MISSING" };
  }
  return NextResponse.json({ data: result }, { status: result.ok ? 200 : 424 });
}
