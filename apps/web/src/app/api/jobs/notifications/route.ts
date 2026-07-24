import { NextResponse } from "next/server";
import { jobHandler } from "@shime/web/server/api/job-handler";
import { dispatchNotifications } from "@shime/web/server/notification-dispatch-use-case";
import { writeOperationalLog } from "@shime/web/server/operational-log";

const run = jobHandler(
  {
    minimumSecretLength: 32,
    unauthorizedHeaders: (requestId) => ({ "Cache-Control": "no-store", "x-request-id": requestId }),
    onUnauthorized: ({ requestId }) =>
      writeOperationalLog({
        level: "warn",
        event: "notification_job_rejected",
        requestId,
        route: "/api/jobs/notifications",
        code: "UNAUTHORIZED",
      }),
  },
  async ({ requestId }) => {
    const startedAt = Date.now();
    const result = await dispatchNotifications.execute();
    writeOperationalLog({
      level: result.failed > 0 ? "warn" : "info",
      event: "notification_job_completed",
      requestId,
      route: "/api/jobs/notifications",
      durationMs: Date.now() - startedAt,
      ...result,
    });
    return NextResponse.json(
      { data: result, request_id: requestId },
      { headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  },
);

export const GET = run;
export const POST = run;
