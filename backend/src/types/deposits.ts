export type DepositDoc = {
  id: string;
  walletId: string | null;
  blockchain: string | null;
  txHash: string | null;
  state: string;
  symbol: string | null;
  tokenAddress: string | null;
  decimals: number | null;
  amount: string;
  createdAt: unknown;
  updatedAt: unknown;
};
