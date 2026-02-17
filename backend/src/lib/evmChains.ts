import { type SupportedChain } from "./chains.js";

export const EVM_CHAIN_ID_BY_CIRCLE_CHAIN: Partial<Record<SupportedChain, number>> = {
  "ETH-SEPOLIA": 11155111,
  "MATIC-AMOY": 80002,
  "ARB-SEPOLIA": 421614,
  "OP-SEPOLIA": 11155420,
  "BASE-SEPOLIA": 84532,
};

export const isSupportedEvmCircleChain = (
  chain: string,
): chain is keyof typeof EVM_CHAIN_ID_BY_CIRCLE_CHAIN => {
  return Object.prototype.hasOwnProperty.call(EVM_CHAIN_ID_BY_CIRCLE_CHAIN, chain);
};
