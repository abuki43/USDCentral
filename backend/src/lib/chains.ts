export const SUPPORTED_EVM_CHAINS = [
  "ETH-SEPOLIA",
  "MATIC-AMOY",
  "ARB-SEPOLIA",
  "OP-SEPOLIA",
  "BASE-SEPOLIA",
] as const;

export const SUPPORTED_SOL_CHAINS = ["SOL-DEVNET"] as const;

export const HUB_DESTINATION_CHAIN = "ARB-SEPOLIA" as const;

export type SupportedChain =
  | (typeof SUPPORTED_EVM_CHAINS)[number]
  | (typeof SUPPORTED_SOL_CHAINS)[number];

const CHAIN_ALIASES: Record<string, SupportedChain> = {
  "ETH-SEPOLIA": "ETH-SEPOLIA",
  "ETHEREUM-SEPOLIA": "ETH-SEPOLIA",
  "MATIC-AMOY": "MATIC-AMOY",
  "POLYGON-AMOY": "MATIC-AMOY",
  "POLYGON-AMOY-TESTNET": "MATIC-AMOY",
  "ARB-SEPOLIA": "ARB-SEPOLIA",
  "ARBITRUM-SEPOLIA": "ARB-SEPOLIA",
  "OP-SEPOLIA": "OP-SEPOLIA",
  "OPTIMISM-SEPOLIA": "OP-SEPOLIA",
  "BASE-SEPOLIA": "BASE-SEPOLIA",
  "SOL-DEVNET": "SOL-DEVNET",
  "SOLANA-DEVNET": "SOL-DEVNET",
};

export const normalizeSupportedChain = (
  value?: string | null,
): SupportedChain | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/_/g, "-");
  return CHAIN_ALIASES[normalized] ?? null;
};
