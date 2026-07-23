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
  includeRequestIdInAuthErrors?: boolean;
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
      const includeRequestId = options.includeRequestIdInAuthErrors ?? true;
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
        if (error instanceof AppError) return appErrorResponse(error, requestId);
        throw error;
      }
    };
  };
}

export const staffHandler = createStaffHandler();

export async function parseJsonBody<Output>(request: Request, schema: z.ZodType<Output>): Promise<Output> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ValidationError();
  return parsed.data;
}
