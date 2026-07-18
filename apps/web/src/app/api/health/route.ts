import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  return NextResponse.json(
    { status: "ok", request_id: requestId },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}
