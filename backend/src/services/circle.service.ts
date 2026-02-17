import admin from "firebase-admin";

import { getCircleClient, getCircleWalletSetId } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import {
  SUPPORTED_EVM_CHAINS,
  SUPPORTED_SOL_CHAINS,
  type SupportedChain,
  normalizeSupportedChain,
} from "../lib/chains.js";
import { USDC_DECIMALS, USDC_TOKEN_ADDRESS_BY_CHAIN } from "../lib/usdcAddresses.js";
import { getWalletByChain } from "../lib/wallets.js";
import { withRetry } from "../lib/retry.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const toBaseUnits = (amount: string, decimals: number) => {
  const [whole, fractionRaw = ""] = amount.split(".");
  const fraction = fractionRaw.padEnd(decimals, "0").slice(0, decimals);
  const normalizedWhole = (whole ?? "0").replace(/^0+(?=\d)/, "") || "0";
  const normalized = `${normalizedWhole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(normalized);
};

const fromBaseUnits = (value: bigint, decimals: number) => {
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const fraction = s.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};

const getUsdcAmountFromBalanceResponse = (resp: any, tokenAddress: string) => {
  const balances = (resp?.data?.tokenBalances ?? []) as Array<{
    amount?: string;
    token?: { tokenAddress?: string | null };
  }>;
  const match = balances.find(
    (entry) =>
      (entry?.token?.tokenAddress ?? "").toLowerCase() === tokenAddress.toLowerCase(),
  );
  return match?.amount ?? "0";
};

type CircleWalletByChain = Record<string, { walletId: string; address: string }>;

export const provisionCircleWalletsForUser = async (uid: string) => {
  const circle = getCircleClient();
  const walletSetId = getCircleWalletSetId();

  const userRef = firestoreAdmin.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const existing = userSnap.data()?.circle as
    | {
        walletSetId?: string;
        walletsByChain?: CircleWalletByChain;
        evmAddress?: string | null;
        solAddress?: string | null;
      }
    | undefined;

  if (existing?.walletsByChain && existing?.evmAddress && existing?.solAddress) {
    return existing;
  }

  const evmResp = await withRetry(
    () =>
      circle.createWallets({
        walletSetId,
        blockchains: [...SUPPORTED_EVM_CHAINS],
        count: 1,
        metadata: [{ refId: uid, name: `user:${uid}` }],
        accountType: "SCA",
      }),
    { retries: 2 },
  );

  const solResp = await withRetry(
    () =>
      circle.createWallets({
        walletSetId,
        blockchains: [...SUPPORTED_SOL_CHAINS],
        count: 1,
        metadata: [{ refId: uid, name: `user:${uid}` }],
        accountType: "EOA",
      }),
    { retries: 2 },
  );

  const wallets = [...(evmResp.data?.wallets ?? []), ...(solResp.data?.wallets ?? [])];

  const walletsByChain: CircleWalletByChain = {};
  for (const w of wallets) {
    const normalizedChain = normalizeSupportedChain(w.blockchain) ?? w.blockchain;
    walletsByChain[normalizedChain] = { walletId: w.id, address: w.address };

    await firestoreAdmin
      .collection("circleWallets")
      .doc(w.id)
      .set(
        {
          uid,
          walletId: w.id,
          blockchain: w.blockchain,
          address: w.address,
          walletSetId: w.walletSetId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
  }

  const evmAddress =
    walletsByChain["ETH-SEPOLIA"]?.address ??
    wallets.find((w) => (SUPPORTED_EVM_CHAINS as readonly string[]).includes(w.blockchain))
      ?.address ??
    null;

  const solAddress = walletsByChain["SOL-DEVNET"]?.address ?? null;

  const circleDoc = {
    walletSetId,
    evmAddress,
    solAddress,
    walletsByChain,
    updatedAt: serverTimestamp(),
    ...(existing?.walletSetId ? {} : { createdAt: serverTimestamp() }),
  };

  await userRef.set({ circle: circleDoc }, { merge: true });

  return circleDoc;
};

export const recomputeUnifiedUsdcBalance = async (uid: string) => {
  const circle = getCircleClient();

  const userRef = firestoreAdmin.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const circleData = userSnap.data()?.circle as
    | {
        walletsByChain?: CircleWalletByChain;
      }
    | undefined;

  const walletsByChain = circleData?.walletsByChain;
  if (!walletsByChain) {
    throw new Error("User has no Circle wallets yet.");
  }

  const perChain: Record<string, { amount: string; microAmount: string }> = {};
  let totalMicro = 0n;

  const chains: SupportedChain[] = [
    ...(SUPPORTED_EVM_CHAINS as unknown as SupportedChain[]),
    ...(SUPPORTED_SOL_CHAINS as unknown as SupportedChain[]),
  ];

  for (const chain of chains) {
    const walletId = getWalletByChain(walletsByChain, chain)?.walletId;
    if (!walletId) continue;

    const tokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[chain];
    const resp = await withRetry(
      () =>
        circle.getWalletTokenBalance({
          id: walletId,
          tokenAddresses: [tokenAddress],
          includeAll: true,
        }),
      { retries: 2 },
    );

    const amount = getUsdcAmountFromBalanceResponse(resp, tokenAddress);
    const micro = toBaseUnits(amount, USDC_DECIMALS);
    totalMicro += micro;

    perChain[chain] = { amount, microAmount: micro.toString() };
  }

  const unified = {
    usdc: {
      decimals: USDC_DECIMALS,
      microAmount: totalMicro.toString(),
      amount: fromBaseUnits(totalMicro, USDC_DECIMALS),
    },
    perChain,
    updatedAt: serverTimestamp(),
  };

  await firestoreAdmin
    .collection("users")
    .doc(uid)
    .collection("balances")
    .doc("unified")
    .set(unified, { merge: true });

  return unified;
};

export const resolveUidFromWalletId = async (walletId: string) => {
  const snap = await firestoreAdmin.collection("circleWallets").doc(walletId).get();
  return (snap.data()?.uid as string | undefined) ?? null;
};
