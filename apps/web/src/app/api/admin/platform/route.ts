import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditLogs,
  getDatabase,
  jobSchedules,
  notificationTemplates,
  notifications,
  tenantOperationalSettings,
  tenantServiceSettings,
  tenants,
} from "@shime/db";
import { requireStaffSession } from "../../../../server/auth";
import { decryptSecrets, encryptSecrets } from "../../../../server/secret-store";
import { buildLinePublicUrls } from "../../../../server/line-client-config";

const input = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("line"),
    enabled: z.boolean(),
    channelId: z.string().trim().max(80),
    liffId: z.string().trim().max(120),
    channelSecret: z.string().trim().max(500).optional(),
    accessToken: z.string().trim().max(2000).optional(),
  }),
  z.object({
    section: z.literal("openai"),
    enabled: z.boolean(),
    model: z.string().trim().min(1).max(120),
    apiKey: z.string().trim().max(500).optional(),
  }),
  z.object({
    section: z.literal("operations"),
    customDomain: z.string().trim().max(255).nullable(),
    healthcheckUrl: z.string().url().max(1000).nullable(),
    monitoringEnabled: z.boolean(),
    notificationFailureThreshold: z.number().int().min(1).max(1000),
  }),
  z.object({
    section: z.literal("schedule"),
    enabled: z.boolean(),
    cronExpression: z
      .string()
      .trim()
      .regex(/^([*\d,\/-]+\s+){4}[*\d,\/-]+$/),
    timezone: z.literal("Asia/Tokyo"),
  }),
]);

async function requireSystemAdmin() {
  const session = await requireStaffSession().catch(() => null);
  if (!session)
    return {
      error: NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }),
    };
  if (session.role !== "system_admin") return { error: NextResponse.json({ code: "FORBIDDEN" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await requireSystemAdmin();
  if (auth.error) return auth.error;
  const { session } = auth;
  const db = getDatabase();
  const [services, operations, schedules, templates, failedRows] = await Promise.all([
    db.select().from(tenantServiceSettings).where(eq(tenantServiceSettings.tenantId, session.tenantId)),
    db
      .select()
      .from(tenantOperationalSettings)
      .where(eq(tenantOperationalSettings.tenantId, session.tenantId))
      .limit(1),
    db.select().from(jobSchedules).where(eq(jobSchedules.tenantId, session.tenantId)),
    db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.tenantId, session.tenantId), eq(notificationTemplates.active, true)))
      .orderBy(desc(notificationTemplates.version)),
    db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.tenantId, session.tenantId), eq(notifications.status, "failed"))),
  ]);
  const service = (key: string) => services.find((item) => item.serviceKey === key);
  const line = service("line");
  const openai = service("openai");
  const tenant = (
    await db.select({ code: tenants.code }).from(tenants).where(eq(tenants.id, session.tenantId)).limit(1)
  )[0];
  const liffId = String(line?.config.liffId ?? process.env.NEXT_PUBLIC_LIFF_ID ?? "");
  const publicAppUrl = operations[0]?.customDomain ? `https://${operations[0].customDomain}` : process.env.APP_URL;
  const lineUrls = buildLinePublicUrls(liffId, publicAppUrl, tenant?.code);
  return NextResponse.json({
    data: {
      line: {
        enabled: line?.enabled ?? true,
        channelId: String(line?.config.channelId ?? process.env.LINE_CHANNEL_ID ?? ""),
        liffId,
        ...lineUrls,
        secretConfigured: Boolean(
          line?.encryptedSecrets || (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
        ),
        fingerprint: line?.secretFingerprint ?? null,
        lastCheckedAt: line?.lastCheckedAt,
        lastCheckStatus: line?.lastCheckStatus,
        lastCheckCode: line?.lastCheckCode,
      },
      openai: {
        enabled: openai?.enabled ?? false,
        model: String(openai?.config.model ?? "gpt-5.4-mini"),
        secretConfigured: Boolean(openai?.encryptedSecrets || process.env.OPENAI_API_KEY),
        fingerprint: openai?.secretFingerprint ?? null,
        lastCheckedAt: openai?.lastCheckedAt,
        lastCheckStatus: openai?.lastCheckStatus,
        lastCheckCode: openai?.lastCheckCode,
      },
      operations: operations[0] ?? {
        customDomain: null,
        healthcheckUrl: process.env.APP_URL ?? null,
        monitoringEnabled: true,
        notificationFailureThreshold: 1,
      },
      schedule: schedules.find((item) => item.jobKey === "notification_dispatch") ?? {
        enabled: false,
        cronExpression: "*/5 * * * *",
        timezone: "Asia/Tokyo",
        lastRunAt: null,
        lastRunStatus: null,
        lastRunSummary: null,
      },
      templates,
      metrics: { failedNotifications: Number(failedRows[0]?.count ?? 0) },
    },
  });
}

export async function PUT(request: Request) {
  const requestId = randomUUID();
  const auth = await requireSystemAdmin();
  if (auth.error) return auth.error;
  const { session } = auth;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  const db = getDatabase();
  const now = new Date();
  const data = parsed.data;
  await db.transaction(async (tx) => {
    if (data.section === "line" || data.section === "openai") {
      const current = (
        await tx
          .select()
          .from(tenantServiceSettings)
          .where(
            and(
              eq(tenantServiceSettings.tenantId, session.tenantId),
              eq(tenantServiceSettings.serviceKey, data.section),
            ),
          )
          .limit(1)
      )[0];
      const supplied =
        data.section === "line"
          ? {
              ...(data.channelSecret ? { channelSecret: data.channelSecret } : {}),
              ...(data.accessToken ? { accessToken: data.accessToken } : {}),
            }
          : { ...(data.apiKey ? { apiKey: data.apiKey } : {}) };
      const previousSecrets = current?.encryptedSecrets ? decryptSecrets(current.encryptedSecrets) : {};
      const encrypted = Object.keys(supplied).length ? encryptSecrets({ ...previousSecrets, ...supplied }) : null;
      const config =
        data.section === "line" ? { channelId: data.channelId, liffId: data.liffId } : { model: data.model };
      await tx
        .insert(tenantServiceSettings)
        .values({
          tenantId: session.tenantId,
          serviceKey: data.section,
          enabled: data.enabled,
          config,
          encryptedSecrets: encrypted?.encrypted ?? current?.encryptedSecrets ?? null,
          secretFingerprint: encrypted?.fingerprint ?? current?.secretFingerprint ?? null,
          updatedBy: session.userId,
        })
        .onConflictDoUpdate({
          target: [tenantServiceSettings.tenantId, tenantServiceSettings.serviceKey],
          set: {
            enabled: data.enabled,
            config,
            encryptedSecrets: encrypted?.encrypted ?? current?.encryptedSecrets ?? null,
            secretFingerprint: encrypted?.fingerprint ?? current?.secretFingerprint ?? null,
            updatedBy: session.userId,
            updatedAt: now,
          },
        });
    } else if (data.section === "operations") {
      await tx
        .insert(tenantOperationalSettings)
        .values({
          tenantId: session.tenantId,
          customDomain: data.customDomain || null,
          healthcheckUrl: data.healthcheckUrl || null,
          monitoringEnabled: data.monitoringEnabled,
          notificationFailureThreshold: data.notificationFailureThreshold,
          updatedBy: session.userId,
        })
        .onConflictDoUpdate({
          target: tenantOperationalSettings.tenantId,
          set: {
            customDomain: data.customDomain || null,
            healthcheckUrl: data.healthcheckUrl || null,
            monitoringEnabled: data.monitoringEnabled,
            notificationFailureThreshold: data.notificationFailureThreshold,
            updatedBy: session.userId,
            updatedAt: now,
          },
        });
    } else {
      await tx
        .insert(jobSchedules)
        .values({
          tenantId: session.tenantId,
          jobKey: "notification_dispatch",
          enabled: data.enabled,
          cronExpression: data.cronExpression,
          timezone: data.timezone,
          updatedBy: session.userId,
        })
        .onConflictDoUpdate({
          target: [jobSchedules.tenantId, jobSchedules.jobKey],
          set: {
            enabled: data.enabled,
            cronExpression: data.cronExpression,
            timezone: data.timezone,
            updatedBy: session.userId,
            updatedAt: now,
          },
        });
    }
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: `platform.${data.section}.update`,
      targetType: "tenant",
      targetId: session.tenantId,
      after: {
        section: data.section,
        secretUpdated:
          data.section === "line"
            ? Boolean(data.channelSecret || data.accessToken)
            : data.section === "openai"
              ? Boolean(data.apiKey)
              : false,
      },
      requestId,
    });
  });
  return NextResponse.json({ ok: true, request_id: requestId });
}
