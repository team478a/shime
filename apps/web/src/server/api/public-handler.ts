import { randomUUID } from "node:crypto";
import { AppError, appErrorResponse } from "./errors";

export type PublicHandlerContext = {
  requestId: string;
};

type PublicHandlerOptions = {
  includeRequestIdInErrors?: boolean;
};

type PublicHandlerDependencies = {
  createRequestId: (request: Request) => string;
};

const defaultDependencies: PublicHandlerDependencies = {
  createRequestId: (request) => request.headers.get("x-request-id") ?? randomUUID(),
};

export function createPublicHandler(dependencies: PublicHandlerDependencies = defaultDependencies) {
  return function publicHandler<Arguments extends [Request, ...unknown[]]>(
    options: PublicHandlerOptions,
    handle: (context: PublicHandlerContext, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return async (...args: Arguments): Promise<Response> => {
      const requestId = dependencies.createRequestId(args[0]);
      try {
        return await handle({ requestId }, ...args);
      } catch (error) {
        if (error instanceof AppError) {
          return appErrorResponse(error, requestId, options.includeRequestIdInErrors ?? false);
        }
        throw error;
      }
    };
  };
}

export const publicHandler = createPublicHandler();

export function createPublicEventHandler(dependencies: PublicHandlerDependencies = defaultDependencies) {
  return function publicEventHandler<Arguments extends [Request, ...unknown[]]>(
    options: PublicHandlerOptions,
    resolveEventId: (...args: Arguments) => Promise<string> | string,
    handle: (context: PublicHandlerContext & { eventId: string }, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return createPublicHandler(dependencies)(options, async (context, ...args: Arguments) =>
      handle({ ...context, eventId: await resolveEventId(...args) }, ...args),
    );
  };
}

export const publicEventHandler = createPublicEventHandler();
