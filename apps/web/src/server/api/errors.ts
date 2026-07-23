import { NextResponse } from "next/server";

type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly publicMessage?: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(code);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(code = "INVALID_INPUT", publicMessage?: string, fieldErrors?: FieldErrors) {
    super(code, 400, publicMessage, fieldErrors);
  }
}

export class PermissionError extends AppError {
  constructor(code = "FORBIDDEN", publicMessage?: string) {
    super(code, 403, publicMessage);
  }
}

export class BusinessRuleError extends AppError {
  constructor(code: string, status = 409, publicMessage?: string) {
    super(code, status, publicMessage);
  }
}

export class InfrastructureError extends AppError {
  constructor(code = "INFRASTRUCTURE_ERROR", publicMessage?: string) {
    super(code, 500, publicMessage);
  }
}

export function appErrorResponse(error: AppError, requestId: string) {
  return NextResponse.json(
    {
      code: error.code,
      ...(error.publicMessage ? { message: error.publicMessage } : {}),
      ...(error.fieldErrors ? { field_errors: error.fieldErrors } : {}),
      request_id: requestId,
    },
    { status: error.status },
  );
}
