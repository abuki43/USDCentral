import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

import { BadRequestError } from "../lib/errors.js";

export const validateBody = <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new BadRequestError("Invalid request body", {
          issues: result.error.issues,
        }),
      );
    }
    (req as Request & { validatedBody?: T }).validatedBody = result.data;
    return next();
  };

export const validateQuery = <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new BadRequestError("Invalid query parameters", {
          issues: result.error.issues,
        }),
      );
    }
    (req as Request & { validatedQuery?: T }).validatedQuery = result.data;
    return next();
  };

declare module "express-serve-static-core" {
  interface Request {
    validatedBody?: unknown;
    validatedQuery?: unknown;
  }
}
