import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase, jobSchedules, tenantOperationalSettings } from "@shime/db";
import { hasValidBearerSecret } from "@shime/web/server/operational-security";

async function run(request: Request) {
  const expected = process.env.INTERNAL_JOB_SECRET; if (!expected || !hasValidBearerSecret(request.headers.get("authorization"), expected)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const db = getDatabase(); const settings = await db.select().from(tenantOperationalSettings).where(eq(tenantOperationalSettings.monitoringEnabled, true)); let healthy = 0; let failed = 0;
  for (const item of settings) { const url = item.healthcheckUrl ?? `${process.env.APP_URL}/api/health`; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000); let ok = false; try { const response = await fetch(url, { signal: controller.signal, cache: "no-store" }); ok = response.ok; } catch { ok = false; } finally { clearTimeout(timer); } if (ok) healthy++; else failed++; await db.update(jobSchedules).set({ lastRunAt: new Date(), lastRunStatus: ok ? "success" : "failed", lastRunSummary: { healthy: ok ? 1 : 0, failed: ok ? 0 : 1 }, updatedAt: new Date() }).where(and(eq(jobSchedules.tenantId, item.tenantId), eq(jobSchedules.jobKey, "health_monitor"))); }
  return NextResponse.json({ data: { checked: settings.length, healthy, failed } });
}
export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
