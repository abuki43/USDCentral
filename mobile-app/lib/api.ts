import { backendFetch } from '@/lib/backend';

export type CurvePosition = {
  id?: string;
  status?: string;
  lpBalance?: string;
  lpDecimals?: number;
  usdcValue?: string;
  poolAddress?: string;
  lpTokenAddress?: string;
  updatedAt?: unknown;
};

export type LiquidityQuote = {
  amount: string;
  poolAddress: string;
  lpTokenAddress: string;
  usdcIndex: number;
  poolSize: number;
  estimatedLpTokens: string;
  minMintAmount: string;
  slippageBps: number;
};

export type BridgeEstimate = {
  fees?: { type?: string; amount?: string }[];
};

export type ResolvedRecipient = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

export const api = {
  liquidity: {
    quote: async (amount: string) => {
      const data = await backendFetch('/liquidity/quote', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      return (data as { quote?: LiquidityQuote | null }).quote ?? null;
    },
    deposit: async (amount: string) => {
      await backendFetch('/liquidity/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    },
    position: async () => {
      const data = await backendFetch('/liquidity/position');
      return (data as { position?: CurvePosition | null }).position ?? null;
    },
    withdraw: async (amount: string) => {
      await backendFetch('/liquidity/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    },
  },
  bridge: {
    estimate: async (params: {
      destinationChain: string;
      recipientAddress: string;
      amount: string;
    }) => {
      const data = await backendFetch('/bridge/estimate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return (data as { estimate?: BridgeEstimate | null }).estimate ?? null;
    },
    withdraw: async (params: {
      destinationChain: string;
      recipientAddress: string;
      amount: string;
    }) => {
      await backendFetch('/bridge/withdraw', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  },
  transfer: {
    resolve: async (uid: string) => {
      const data = await backendFetch(
        `/transfer/resolve?uid=${encodeURIComponent(uid)}`,
      );
      return data as ResolvedRecipient;
    },
    resolveEmail: async (email: string) => {
      const data = await backendFetch(
        `/transfer/resolve-email?email=${encodeURIComponent(email)}`,
      );
      return data as ResolvedRecipient;
    },
    send: async (params: { recipientUid: string; amount: string }) => {
      await backendFetch('/transfer/send', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  },
  circle: {
    provision: async () => {
      return backendFetch('/circle/provision', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  },
};
