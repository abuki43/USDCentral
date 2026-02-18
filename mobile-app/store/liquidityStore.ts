import { create } from 'zustand';

import { api, type CurvePosition, type LiquidityQuote } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

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
      const quote = await api.liquidity.quote(amount);
      set({ quote });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to load quote') });
    } finally {
      set({ isLoading: false });
    }
  },
  deposit: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      await api.liquidity.deposit(amount);
      await get().loadPosition();
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to deposit') });
    } finally {
      set({ isLoading: false });
    }
  },
  loadPosition: async () => {
    set({ isLoading: true, error: null });
    try {
      const position = await api.liquidity.position();
      set({ position });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to load position') });
    } finally {
      set({ isLoading: false });
    }
  },
  withdraw: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      await api.liquidity.withdraw(amount);
      await get().loadPosition();
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to withdraw') });
    } finally {
      set({ isLoading: false });
    }
  },
}));
