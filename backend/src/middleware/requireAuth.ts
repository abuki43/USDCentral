import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";

import { firebaseAuthAdmin } from "../lib/firebaseAdmin.js";
import { UnauthorizedError } from "../lib/errors.js";

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing bearer token."));
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = await firebaseAuthAdmin.verifyIdToken(token);
    (req as AuthenticatedRequest).user = decoded;
    return next();
  } catch (error) {
    return next(new UnauthorizedError("Invalid or expired token."));
  }
};
