import rateLimit from "express-rate-limit";

import { config } from "../config.js";

const windowMs = Number.isFinite(config.rateLimitWindowMs)
  ? config.rateLimitWindowMs
  : 60_000;
const max = Number.isFinite(config.rateLimitMax) ? config.rateLimitMax : 120;

export const apiRateLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "unknown",
});
