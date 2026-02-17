import type { SupportedChain } from "./chains.js";

export const USDC_DECIMALS = 6;

// Circle DCW `getWalletTokenBalance` filters by token address (EVM) / mint (Solana).
export const USDC_TOKEN_ADDRESS_BY_CHAIN: Record<SupportedChain, string> = {
  "ETH-SEPOLIA": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "MATIC-AMOY": "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  "ARB-SEPOLIA": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  "OP-SEPOLIA": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  "BASE-SEPOLIA": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "SOL-DEVNET": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};
