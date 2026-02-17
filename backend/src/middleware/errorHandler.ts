import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
      details: err.details ?? undefined,
      requestId,
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  logger.error({ err }, "Unhandled error");
  return res
    .status(500)
    .json({ message, code: "INTERNAL_ERROR", requestId });
};
