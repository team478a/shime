import { randomUUID } from "node:crypto";
import type { Permission } from "@shime/core";
import { hasPermission } from "@shime/core";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireStaffSession } from "../auth";
import { AppError, appErrorResponse, ValidationError } from "./errors";

type StaffSession = Awaited<ReturnType<typeof requireStaffSession>>;

export type StaffHandlerContext = {
  requestId: string;
  session: StaffSession;
};

type StaffHandlerOptions = {
  permission: Permission;
  includeRequestIdInErrors?: boolean;
};

type StaffHandlerDependencies = {
  loadSession: () => Promise<StaffSession | null>;
  createRequestId: () => string;
};

const defaultDependencies: StaffHandlerDependencies = {
  loadSession: () => requireStaffSession().catch(() => null),
  createRequestId: randomUUID,
};

export function createStaffHandler(dependencies: StaffHandlerDependencies = defaultDependencies) {
  return function staffHandler<Arguments extends unknown[]>(
    options: StaffHandlerOptions,
    handle: (context: StaffHandlerContext, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return async (...args: Arguments): Promise<Response> => {
      const requestId = dependencies.createRequestId();
      const includeRequestId = options.includeRequestIdInErrors ?? true;
      const session = await dependencies.loadSession();

      if (!session) {
        return NextResponse.json(
          { code: "UNAUTHORIZED", ...(includeRequestId ? { request_id: requestId } : {}) },
          { status: 401 },
        );
      }
      if (!hasPermission(session.role, options.permission)) {
        return NextResponse.json(
          { code: "FORBIDDEN", ...(includeRequestId ? { request_id: requestId } : {}) },
          { status: 403 },
        );
      }

      try {
        return await handle({ requestId, session }, ...args);
      } catch (error) {
        if (error instanceof AppError) return appErrorResponse(error, requestId, includeRequestId);
        throw error;
      }
    };
  };
}

export const staffHandler = createStaffHandler();

export function createStaffEventHandler(dependencies: StaffHandlerDependencies = defaultDependencies) {
  return function staffEventHandler<Arguments extends unknown[]>(
    options: StaffHandlerOptions,
    resolveEventId: (...args: Arguments) => Promise<string> | string,
    handle: (context: StaffHandlerContext & { eventId: string }, ...args: Arguments) => Promise<Response> | Response,
  ) {
    return createStaffHandler(dependencies)(options, async (context, ...args: Arguments) => {
      const eventId = await resolveEventId(...args);
      if (context.session.eventId && context.session.eventId !== eventId) {
        const includeRequestId = options.includeRequestIdInErrors ?? true;
        return NextResponse.json(
          {
            code: "FORBIDDEN",
            ...(includeRequestId ? { request_id: context.requestId } : {}),
          },
          { status: 403 },
        );
      }
      return handle({ ...context, eventId }, ...args);
    });
  };
}

export const staffEventHandler = createStaffEventHandler();

export async function parseJsonBody<Output>(
  request: Request,
  schema: z.ZodType<Output>,
  errorCode = "INVALID_INPUT",
): Promise<Output> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ValidationError(errorCode);
  return parsed.data;
}
