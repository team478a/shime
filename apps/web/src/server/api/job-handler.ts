import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "../operational-security";
import { AppError, appErrorResponse } from "./errors";

export type JobHandlerContext = {
  requestId: string;
};

type JobHandlerOptions = {
  includeRequestIdInErrors?: boolean;
  minimumSecretLength?: number;
  unauthorizedHeaders?: (requestId: string) => HeadersInit;
  onUnauthorized?: (context: JobHandlerContext, request: Request) => void;
};

type JobHandlerDependencies = {
  loadSecret: () => string | undefined;
  validateBearer: (authorization: string | null, expectedSecret: string) => boolean;
  createRequestId: (request: Request) => string;
};

const defaultDependencies: JobHandlerDependencies = {
  loadSecret: () => process.env.INTERNAL_JOB_SECRET,
  validateBearer: hasValidBearerSecret,
  createRequestId: (request) => request.headers.get("x-request-id") ?? randomUUID(),
};

export function createJobHandler(dependencies: JobHandlerDependencies = defaultDependencies) {
  return function jobHandler<Arguments extends [Request, ...unknown[]]>(
    options: JobHandlerOptions,
    handle: (context: JobHandlerContext, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return async (...args: Arguments): Promise<Response> => {
      const request = args[0];
      const requestId = dependencies.createRequestId(request);
      const includeRequestId = options.includeRequestIdInErrors ?? true;
      const expectedSecret = dependencies.loadSecret();
      if (options.minimumSecretLength && (!expectedSecret || expectedSecret.length < options.minimumSecretLength)) {
        throw new Error("INVALID_JOB_SECRET_CONFIGURATION");
      }
      if (!expectedSecret || !dependencies.validateBearer(request.headers.get("authorization"), expectedSecret)) {
        options.onUnauthorized?.({ requestId }, request);
        const headers = options.unauthorizedHeaders?.(requestId);
        return NextResponse.json(
          { code: "UNAUTHORIZED", ...(includeRequestId ? { request_id: requestId } : {}) },
          { status: 401, ...(headers ? { headers } : {}) },
        );
      }

      try {
        return await handle({ requestId }, ...args);
      } catch (error) {
        if (error instanceof AppError) return appErrorResponse(error, requestId, includeRequestId);
        throw error;
      }
    };
  };
}

export const jobHandler = createJobHandler();
