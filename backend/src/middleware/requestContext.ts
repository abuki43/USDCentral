import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";

import { logger } from "../lib/logger.js";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
    log?: typeof logger;
  }
}

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header("X-Request-Id") ?? crypto.randomUUID();
  req.requestId = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("X-Request-Id", requestId);
  next();
};
