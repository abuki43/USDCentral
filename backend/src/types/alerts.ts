export type InboundTokenAlert = {
  txId: string;
  stage: "INCOMING";
  amount: string;
  symbol: string | null;
  blockchain: string | null;
  tokenAddress: string | null;
  updatedAt: unknown;
};

export type FinalizedTokenAlert = {
  originTxId: string;
  stage: "FINALIZED";
  amount: string;
  symbol: string | null;
  sourceChain: string | null;
  destinationChain: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAt: unknown;
};
