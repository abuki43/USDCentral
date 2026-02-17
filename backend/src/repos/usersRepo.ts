import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import type { SupportedChain } from "../lib/chains.js";

type WalletByChainEntry = { walletId?: string; address?: string };
export type WalletsByChain = Record<string, WalletByChainEntry>;

export const getUserRef = (uid: string) =>
  firestoreAdmin.collection("users").doc(uid);

export const getUserSnapshot = async (uid: string) => getUserRef(uid).get();

export const getUserCircleWalletsByChain = async (uid: string) => {
  const snap = await getUserSnapshot(uid);
  return (snap.data()?.circle?.walletsByChain ?? {}) as WalletsByChain;
};

export const getUserCircleWalletByChain = async (
  uid: string,
  chain: SupportedChain,
) => {
  const walletsByChain = await getUserCircleWalletsByChain(uid);
  return walletsByChain[chain] ?? null;
};
