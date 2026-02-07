export type TransactionRecord = {
  id: string;
  kind: "DEPOSIT" | "WITHDRAW" | "SEND" | "SWAP" | "BRIDGE" | "EARN";
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "FAILED" | "BRIDGING";
  amount: string;
  symbol: string | null;
  blockchain: string | null;
  sourceChain?: string | null;
  destinationChain?: string | null;
  txHash?: string | null;
  relatedTxId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: unknown;
  updatedAt: unknown;
};
