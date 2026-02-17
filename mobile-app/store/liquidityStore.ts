import { create } from 'zustand';

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

type LiquidityQuote = {
  amount: string;
  poolAddress: string;
  lpTokenAddress: string;
  usdcIndex: number;
  poolSize: number;
  estimatedLpTokens: string;
  minMintAmount: string;
  slippageBps: number;
};

type LiquidityState = {
  isLoading: boolean;
  error: string | null;
  quote: LiquidityQuote | null;
  position: CurvePosition | null;
  fetchQuote: (amount: string) => Promise<void>;
  deposit: (amount: string) => Promise<void>;
  loadPosition: () => Promise<void>;
  withdraw: (amount: string) => Promise<void>;
};

export const useLiquidityStore = create<LiquidityState>((set, get) => ({
  isLoading: false,
  error: null,
  quote: null,
  position: null,
  fetchQuote: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      const data = await backendFetch('/liquidity/quote', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      set({ quote: data.quote ?? null });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to load quote' });
    } finally {
      set({ isLoading: false });
    }
  },
  deposit: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      await backendFetch('/liquidity/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      await get().loadPosition();
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to deposit' });
    } finally {
      set({ isLoading: false });
    }
  },
  loadPosition: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await backendFetch('/liquidity/position');
      set({ position: data.position ?? null });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to load position' });
    } finally {
      set({ isLoading: false });
    }
  },
  withdraw: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      await backendFetch('/liquidity/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      await get().loadPosition();
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to withdraw' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
