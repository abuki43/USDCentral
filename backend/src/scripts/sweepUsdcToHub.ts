import dotenv from "dotenv";

import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { getCircleClient } from "../lib/circleClient.js";
import {
  HUB_DESTINATION_CHAIN,
  SUPPORTED_EVM_CHAINS,
  type SupportedChain,
} from "../lib/chains.js";
import { USDC_DECIMALS, USDC_TOKEN_ADDRESS_BY_CHAIN } from "../lib/usdcAddresses.js";
import { getWalletByChain } from "../lib/wallets.js";
import { bridgeUsdcToHubForUser } from "../services/bridge.service.js";
import { recomputeUnifiedUsdcBalance } from "../services/circle.service.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const toBaseUnits = (amount: string, decimals: number) => {
  const [whole, fractionRaw = ""] = amount.split(".");
  const fraction = fractionRaw.padEnd(decimals, "0").slice(0, decimals);
  const normalizedWhole = (whole ?? "0").replace(/^0+(?=\d)/, "") || "0";
  const normalized = `${normalizedWhole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(normalized);
};

const parseArg = (flag: string) => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

const dryRun = hasFlag("--dry-run");
const uidFilter = parseArg("--uid");
const minAmount = parseArg("--min-amount") ?? "0";
const minAmountBase = toBaseUnits(minAmount, USDC_DECIMALS);

const circle = getCircleClient();

const getWalletId = (data: any, chain: SupportedChain) =>
  getWalletByChain(data?.circle?.walletsByChain, chain)?.walletId as
    | string
    | undefined;

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

const getStepTxHash = (result: any, stepName: string) => {
  const steps = result?.steps ?? result?.result?.steps ?? [];
  if (!Array.isArray(steps)) return null;
  const step = steps.find((s: any) => s?.name === stepName);
  return step?.txHash ?? step?.data?.txHash ?? null;
};

const main = async () => {
  console.log("[sweep] start", { dryRun, uidFilter, minAmount });

  const userSnap = await firestoreAdmin.collection("users").get();
  for (const doc of userSnap.docs) {
    const uid = doc.id;
    if (uidFilter && uidFilter !== uid) continue;

    const data = doc.data();
    const tasks: Array<{ chain: SupportedChain; amount: string }> = [];

    for (const chain of SUPPORTED_EVM_CHAINS as unknown as SupportedChain[]) {
      if (chain === HUB_DESTINATION_CHAIN) continue;

      const walletId = getWalletId(data, chain);
      if (!walletId) continue;

      const tokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[chain];
      const resp = await circle.getWalletTokenBalance({
        id: walletId,
        tokenAddresses: [tokenAddress],
        includeAll: true,
      });

      const amount = getUsdcAmountFromBalanceResponse(resp, tokenAddress);
      const amountBase = toBaseUnits(amount, USDC_DECIMALS);
      if (amountBase <= minAmountBase) continue;

      tasks.push({ chain, amount });
    }

    if (tasks.length === 0) {
      console.log("[sweep] no balances", { uid });
      continue;
    }

    for (const task of tasks) {
      if (dryRun) {
        console.log("[sweep] dry-run", {
          uid,
          sourceChain: task.chain,
          destinationChain: HUB_DESTINATION_CHAIN,
          amount: task.amount,
        });
        continue;
      }

      try {
        console.log("[sweep] bridging", {
          uid,
          sourceChain: task.chain,
          destinationChain: HUB_DESTINATION_CHAIN,
          amount: task.amount,
        });
        const result = await bridgeUsdcToHubForUser({
          uid,
          sourceChain: task.chain,
          amount: task.amount,
        });
        console.log("[sweep] bridge submitted", {
          uid,
          sourceChain: task.chain,
          destinationChain: HUB_DESTINATION_CHAIN,
          amount: task.amount,
          burnTxHash: getStepTxHash(result, "burn"),
          mintTxHash: getStepTxHash(result, "mint"),
        });
      } catch (error) {
        console.error("[sweep] bridge failed", {
          uid,
          sourceChain: task.chain,
          destinationChain: HUB_DESTINATION_CHAIN,
          amount: task.amount,
          error: (error as Error)?.message,
        });
      }
    }

    try {
      await recomputeUnifiedUsdcBalance(uid);
      console.log("[sweep] recomputed balance", { uid });
    } catch (error) {
      console.error("[sweep] recompute failed", {
        uid,
        error: (error as Error)?.message,
      });
    }
  }

  console.log("[sweep] complete");
};

main().catch((error) => {
  console.error("[sweep] fatal", (error as Error).message);
  process.exit(1);
});
