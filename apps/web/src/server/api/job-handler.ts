import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "../operational-security";
import { AppError, appErrorResponse } from "./errors";

export type JobHandlerContext = {
  requestId: string;
};

type JobHandlerOptions = {
  includeRequestIdInErrors?: boolean;
};

type JobHandlerDependencies = {
  loadSecret: () => string | undefined;
  validateBearer: (authorization: string | null, expectedSecret: string) => boolean;
  createRequestId: () => string;
};

const defaultDependencies: JobHandlerDependencies = {
  loadSecret: () => process.env.INTERNAL_JOB_SECRET,
  validateBearer: hasValidBearerSecret,
  createRequestId: randomUUID,
};

export function createJobHandler(dependencies: JobHandlerDependencies = defaultDependencies) {
  return function jobHandler<Arguments extends [Request, ...unknown[]]>(
    options: JobHandlerOptions,
    handle: (context: JobHandlerContext, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return async (...args: Arguments): Promise<Response> => {
      const requestId = dependencies.createRequestId();
      const includeRequestId = options.includeRequestIdInErrors ?? true;
      const expectedSecret = dependencies.loadSecret();
      if (!expectedSecret || !dependencies.validateBearer(args[0].headers.get("authorization"), expectedSecret)) {
        return NextResponse.json(
          { code: "UNAUTHORIZED", ...(includeRequestId ? { request_id: requestId } : {}) },
          { status: 401 },
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
