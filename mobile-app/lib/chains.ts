export const WITHDRAW_CHAINS = [
  'BASE-SEPOLIA',
  'ETH-SEPOLIA',
  'ARB-SEPOLIA',
  'OP-SEPOLIA',
  'MATIC-AMOY',
  'SOL-DEVNET',
] as const;

export type WithdrawChain = (typeof WITHDRAW_CHAINS)[number];

export const CHAIN_LABELS: Record<WithdrawChain, string> = {
  'BASE-SEPOLIA': 'Base Sepolia',
  'ETH-SEPOLIA': 'Ethereum Sepolia',
  'ARB-SEPOLIA': 'Arbitrum Sepolia',
  'OP-SEPOLIA': 'Optimism Sepolia',
  'MATIC-AMOY': 'Polygon Amoy',
  'SOL-DEVNET': 'Solana Devnet',
};
