import { normalizeSupportedChain, type SupportedChain } from "./chains.js";

type WalletByChainEntry = { walletId?: string; address?: string };

type WalletsByChain = Record<string, WalletByChainEntry> | undefined | null;

export const getWalletByChain = (
  walletsByChain: WalletsByChain,
  chain: SupportedChain,
): WalletByChainEntry | undefined => {
  if (!walletsByChain) return undefined;
  const direct = walletsByChain[chain];
  if (direct) return direct;

  const matchKey = Object.keys(walletsByChain).find(
    (key) => normalizeSupportedChain(key) === chain,
  );
  if (!matchKey) return undefined;
  return walletsByChain[matchKey];
};
