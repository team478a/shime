import { NextResponse } from "next/server";
import { jobHandler } from "@shime/web/server/api/job-handler";
import { matchChatAdmin } from "@shime/web/server/match-chat-admin";
import { writeOperationalLog } from "@shime/web/server/operational-log";

const run = jobHandler(
  {
    minimumSecretLength: 32,
    unauthorizedHeaders: (requestId) => ({ "Cache-Control": "no-store", "x-request-id": requestId }),
    onUnauthorized: ({ requestId }) =>
      writeOperationalLog({
        level: "warn",
        event: "match_chat_retention_job_rejected",
        requestId,
        route: "/api/jobs/match-chat-retention",
        code: "UNAUTHORIZED",
      }),
  },
  async ({ requestId }) => {
    const startedAt = Date.now();
    const result = await matchChatAdmin.purgeExpiredMessages.execute(5000);
    writeOperationalLog({
      level: "info",
      event: "match_chat_retention_job_completed",
      requestId,
      route: "/api/jobs/match-chat-retention",
      durationMs: Date.now() - startedAt,
      processed: result.purged,
    });
    return NextResponse.json(
      { data: result, request_id: requestId },
      { headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  },
);

export const GET = run;
export const POST = run;
