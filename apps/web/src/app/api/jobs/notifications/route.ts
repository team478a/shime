import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDatabase,
  jobSchedules,
  notificationAttempts,
  notifications,
  userIdentities,
} from "@shime/db";
import { getLineProvider } from "@shime/web/server/line-provider";
import { writeOperationalLog } from "@shime/web/server/operational-log";
import {
  hasValidBearerSecret,
  notificationFailureCode,
} from "@shime/web/server/operational-security";

const envSchema = z.object({ INTERNAL_JOB_SECRET: z.string().min(32) });

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const env = envSchema.parse(process.env);
  if (!hasValidBearerSecret(request.headers.get("authorization"), env.INTERNAL_JOB_SECRET)) {
    writeOperationalLog({
      level: "warn",
      event: "notification_job_rejected",
      requestId,
      route: "/api/jobs/notifications",
      code: "UNAUTHORIZED",
    });
    return NextResponse.json(
      { code: "UNAUTHORIZED", request_id: requestId },
      { status: 401, headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  }

  const startedAt = Date.now();
  const db = getDatabase();
  const enabledSchedules = await db.select().from(jobSchedules).where(and(eq(jobSchedules.jobKey, "notification_dispatch"), eq(jobSchedules.enabled, true)));
  const enabledTenantIds = enabledSchedules.map((schedule) => schedule.tenantId);
  const queued = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.status, "queued"),
        lte(notifications.scheduledAt, new Date()),
        enabledTenantIds.length ? inArray(notifications.tenantId, enabledTenantIds) : eq(notifications.tenantId, "00000000-0000-0000-0000-000000000000"),
      ),
    )
    .orderBy(asc(notifications.scheduledAt))
    .limit(20);

  let sent = 0;
  let failed = 0;
  for (const item of queued) {
    const [claimed] = await db
      .update(notifications)
      .set({
        status: "sending",
        attemptCount: item.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, item.id), eq(notifications.status, "queued")))
      .returning();
    if (!claimed) continue;

    const attemptNumber = claimed.attemptCount;
    const [attempt] = await db
      .insert(notificationAttempts)
      .values({
        tenantId: item.tenantId,
        notificationId: item.id,
        attemptNumber,
        startedAt: new Date(),
        status: "sending",
      })
      .returning();

    try {
      const identities = await db
        .select({ lineUserId: userIdentities.providerUserId })
        .from(userIdentities)
        .where(
          and(
            eq(userIdentities.tenantId, item.tenantId),
            eq(userIdentities.userId, item.userId),
            eq(userIdentities.provider, "line"),
          ),
        )
        .limit(1);
      if (!identities[0]) throw new Error("LINE_IDENTITY_MISSING");

      const text = item.payload.text;
      if (typeof text !== "string" || !text) {
        throw new Error("INVALID_NOTIFICATION_PAYLOAD");
      }

      const result = await (await getLineProvider(item.tenantId)).sendPush(identities[0].lineUserId, [
        { type: "text", text },
      ]);
      await db.transaction(async (tx) => {
        await tx
          .update(notifications)
          .set({
            status: "sent",
            sentAt: new Date(),
            errorCode: null,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(notifications.id, item.id));
        if (attempt) {
          await tx
            .update(notificationAttempts)
            .set({
              status: "sent",
              finishedAt: new Date(),
              providerMessageId: result.messageId,
              updatedAt: new Date(),
            })
            .where(eq(notificationAttempts.id, attempt.id));
        }
      });
      sent++;
    } catch (error) {
      const code = notificationFailureCode(error);
      await db.transaction(async (tx) => {
        await tx
          .update(notifications)
          .set({
            status: "failed",
            errorCode: code,
            errorMessage: code,
            updatedAt: new Date(),
          })
          .where(eq(notifications.id, item.id));
        if (attempt) {
          await tx
            .update(notificationAttempts)
            .set({ status: "failed", finishedAt: new Date(), errorCode: code, updatedAt: new Date() })
            .where(eq(notificationAttempts.id, attempt.id));
        }
      });
      failed++;
    }
  }

  const processed = sent + failed;
  if (enabledTenantIds.length) await db.update(jobSchedules).set({ lastRunAt: new Date(), lastRunStatus: failed > 0 ? "warning" : "success", lastRunSummary: { processed, sent, failed }, updatedAt: new Date() }).where(and(eq(jobSchedules.jobKey, "notification_dispatch"), inArray(jobSchedules.tenantId, enabledTenantIds)));
  writeOperationalLog({
    level: failed > 0 ? "warn" : "info",
    event: "notification_job_completed",
    requestId,
    route: "/api/jobs/notifications",
    durationMs: Date.now() - startedAt,
    processed,
    sent,
    failed,
  });
  return NextResponse.json(
    { data: { processed, sent, failed }, request_id: requestId },
    { headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
  );
}

export async function GET(request: Request) { return POST(request); }
