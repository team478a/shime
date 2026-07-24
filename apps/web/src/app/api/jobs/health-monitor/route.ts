import { NextResponse } from "next/server";
import { jobHandler } from "@shime/web/server/api/job-handler";
import { runHealthMonitor } from "@shime/web/server/health-monitor-use-case";

const run = jobHandler({ includeRequestIdInErrors: false }, async () =>
  NextResponse.json({
    data: await runHealthMonitor.execute({
      defaultHealthcheckUrl: `${process.env.APP_URL}/api/health`,
    }),
  }),
);

export const GET = run;
export const POST = run;
