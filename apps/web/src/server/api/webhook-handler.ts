import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError, appErrorResponse } from "./errors";

export type WebhookHandlerContext = {
  requestId: string;
  tenantCode: string;
  rawBody: string;
  signature: string | null;
};

type WebhookHandlerDependencies = {
  createRequestId: (request: Request) => string;
};

const defaultDependencies: WebhookHandlerDependencies = {
  createRequestId: (request) => request.headers.get("x-request-id") ?? randomUUID(),
};

export function createWebhookHandler(dependencies: WebhookHandlerDependencies = defaultDependencies) {
  return function webhookHandler(
    handle: (context: WebhookHandlerContext, request: Request) => Promise<Response> | Response,
  ) {
    return async (request: Request): Promise<Response> => {
      const rawBody = await request.text();
      const tenantCode = new URL(request.url).searchParams.get("tenant");
      if (!tenantCode) return NextResponse.json({ code: "TENANT_REQUIRED" }, { status: 400 });

      const requestId = dependencies.createRequestId(request);
      try {
        return await handle(
          {
            requestId,
            tenantCode,
            rawBody,
            signature: request.headers.get("x-line-signature"),
          },
          request,
        );
      } catch (error) {
        if (error instanceof AppError) return appErrorResponse(error, requestId, false);
        throw error;
      }
    };
  };
}

export const webhookHandler = createWebhookHandler();
