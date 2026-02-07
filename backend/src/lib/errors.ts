export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "EXTERNAL_SERVICE_ERROR";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  details?: Record<string, unknown> | null;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(401, "UNAUTHORIZED", message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ExternalServiceError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(502, "EXTERNAL_SERVICE_ERROR", message, details);
  }
}
