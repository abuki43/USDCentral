import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().optional(),
  CIRCLE_API_KEY: z.string().optional(),
  CIRCLE_ENTITY_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
  TRUST_PROXY: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  JSON_BODY_LIMIT: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().optional(),
  WEBHOOK_REPLAY_WINDOW_SEC: z.string().optional(),
  HUB_CHAIN_RPC_URL: z.string().optional(),
  CURVE_POOL_ADDRESS: z.string().optional(),
  CURVE_LP_TOKEN_ADDRESS: z.string().optional(),
  CURVE_USDC_INDEX: z.string().optional(),
  CURVE_POOL_SIZE: z.string().optional(),
  CURVE_EXPECTED_PAIR_TOKEN_ADDRESS: z.string().optional(),
  CURVE_SLIPPAGE_BPS: z.string().optional(),
  ENABLE_NON_USDC_SWAPS: z.string().optional(),
  SWAP_WORKER_ENABLED: z.string().optional(),
  SWAP_WORKER_INTERVAL_MS: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const message = parsed.error.errors.map((err) => err.message).join("; ");
  throw new Error(`Invalid environment configuration: ${message}`);
}

export const config = {
  ...parsed.data,
  FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  enableNonUsdcSwaps: parsed.data.ENABLE_NON_USDC_SWAPS === "true",
  swapWorkerEnabled:
    (parsed.data.SWAP_WORKER_ENABLED ?? "true").toLowerCase() !== "false",
  swapWorkerIntervalMs: Number(parsed.data.SWAP_WORKER_INTERVAL_MS ?? "5000"),
  trustProxy: (parsed.data.TRUST_PROXY ?? "false").toLowerCase() === "true",
  corsOrigins: (parsed.data.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jsonBodyLimit: parsed.data.JSON_BODY_LIMIT ?? "1mb",
  rateLimitWindowMs: Number(parsed.data.RATE_LIMIT_WINDOW_MS ?? "60000"),
  rateLimitMax: Number(parsed.data.RATE_LIMIT_MAX ?? "120"),
  webhookReplayWindowSec: Number(parsed.data.WEBHOOK_REPLAY_WINDOW_SEC ?? "0"),
};
