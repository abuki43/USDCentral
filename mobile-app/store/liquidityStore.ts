import { create } from 'zustand';

import { backendFetch } from '@/lib/backend';

export type RangePreset = 'narrow' | 'balanced' | 'wide';

export type Position = {
  id: string;
  amount?: string;
  rangePreset?: RangePreset;
  status?: string;
  poolAddress?: string;
  fee?: number;
  createdAt?: unknown;
};

type LiquidityQuote = {
  amount: string;
  rangePreset: RangePreset;
  token: string;
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
};

type LiquidityState = {
  isLoading: boolean;
  error: string | null;
  quote: LiquidityQuote | null;
  positions: Position[];
  fetchQuote: (amount: string, rangePreset: RangePreset) => Promise<void>;
  createPosition: (amount: string, rangePreset: RangePreset) => Promise<void>;
  loadPositions: () => Promise<void>;
  collectFees: (positionId: string) => Promise<void>;
  withdrawPosition: (positionId: string) => Promise<void>;
};

export const useLiquidityStore = create<LiquidityState>((set, get) => ({
  isLoading: false,
  error: null,
  quote: null,
  positions: [],
  fetchQuote: async (amount, rangePreset) => {
    set({ isLoading: true, error: null });
    try {
      const data = await backendFetch('/liquidity/quote', {
        method: 'POST',
        body: JSON.stringify({ amount, rangePreset }),
      });
      set({ quote: data.quote ?? null });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to load quote' });
    } finally {
      set({ isLoading: false });
    }
  },
  createPosition: async (amount, rangePreset) => {
    set({ isLoading: true, error: null });
    try {
      await backendFetch('/liquidity/positions', {
        method: 'POST',
        body: JSON.stringify({ amount, rangePreset }),
      });
      await get().loadPositions();
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to create position' });
    } finally {
      set({ isLoading: false });
    }
  },
  loadPositions: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await backendFetch('/liquidity/positions');
      set({ positions: data.positions ?? [] });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to load positions' });
    } finally {
      set({ isLoading: false });
    }
  },
  collectFees: async (positionId) => {
    set({ isLoading: true, error: null });
    try {
      await backendFetch(`/liquidity/positions/${positionId}/collect`, { method: 'POST' });
      await get().loadPositions();
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to collect fees' });
    } finally {
      set({ isLoading: false });
    }
  },
  withdrawPosition: async (positionId) => {
    set({ isLoading: true, error: null });
    try {
      await backendFetch(`/liquidity/positions/${positionId}/withdraw`, { method: 'POST' });
      await get().loadPositions();
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to withdraw' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
