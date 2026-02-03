import {
  createConfig,
  getRoutes,
  getStepTransaction,
  getStatus,
  type RouteOptions,
} from "@lifi/sdk";

let configured = false;

export const ensureLifiConfigured = () => {
  if (configured) return;
  const integrator = process.env.LIFI_INTEGRATOR || "usdcentral";
  createConfig({ integrator });
  configured = true;
};

export const lifiGetRoutes = async (params: Parameters<typeof getRoutes>[0]) => {
  ensureLifiConfigured();
  return getRoutes(params);
};

export const lifiGetStepTransaction = async (
  params: Parameters<typeof getStepTransaction>[0],
) => {
  ensureLifiConfigured();
  return getStepTransaction(params);
};

export const lifiGetStatus = async (params: Parameters<typeof getStatus>[0]) => {
  ensureLifiConfigured();
  return getStatus(params);
};

export type { RouteOptions };
