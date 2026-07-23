import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@shime/db";
import { writeOperationalLog } from "@shime/web/server/operational-log";
import { hasValidBearerSecret } from "@shime/web/server/operational-security";

const envSchema = z.object({ INTERNAL_JOB_SECRET: z.string().min(32) });
export const dynamic = "force-dynamic";

function response(body: object, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "x-request-id": requestId },
  });
}

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const env = envSchema.parse(process.env);
  if (!hasValidBearerSecret(request.headers.get("authorization"), env.INTERNAL_JOB_SECRET)) {
    writeOperationalLog({
      level: "warn",
      event: "readiness_rejected",
      requestId,
      route: "/api/health/readiness",
      code: "UNAUTHORIZED",
    });
    return response({ code: "UNAUTHORIZED", request_id: requestId }, 401, requestId);
  }

  const startedAt = Date.now();
  try {
    await getDatabase().execute(sql`select 1`);
    return response({ status: "ready", checks: { database: "ok" }, request_id: requestId }, 200, requestId);
  } catch {
    writeOperationalLog({
      level: "error",
      event: "readiness_failed",
      requestId,
      route: "/api/health/readiness",
      code: "DATABASE_UNAVAILABLE",
      durationMs: Date.now() - startedAt,
    });
    return response({ status: "unavailable", checks: { database: "failed" }, request_id: requestId }, 503, requestId);
  }
}
