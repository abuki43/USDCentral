import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";

import { firebaseAuthAdmin } from "../lib/firebaseAdmin.js";

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token." });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = await firebaseAuthAdmin.verifyIdToken(token);
    (req as AuthenticatedRequest).user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
