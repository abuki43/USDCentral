import {
  createConfig,
  getRoutes,
  getStepTransaction,
  getStatus,
  type RouteOptions,
} from "@lifi/sdk";
import { withRetry } from "./retry.js";

let configured = false;

export const ensureLifiConfigured = () => {
  if (configured) return;
  const integrator = process.env.LIFI_INTEGRATOR || "usdcentral";
  createConfig({ integrator });
  configured = true;
};

export const lifiGetRoutes = async (params: Parameters<typeof getRoutes>[0]) => {
  ensureLifiConfigured();
  return withRetry(() => getRoutes(params), { retries: 2 });
};

export const lifiGetStepTransaction = async (
  params: Parameters<typeof getStepTransaction>[0],
) => {
  ensureLifiConfigured();
  return withRetry(() => getStepTransaction(params), { retries: 2 });
};

export const lifiGetStatus = async (params: Parameters<typeof getStatus>[0]) => {
  ensureLifiConfigured();
  return withRetry(() => getStatus(params), { retries: 2 });
};

export type { RouteOptions };
