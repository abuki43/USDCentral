import dotenv from "dotenv";

import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { getCircleClient } from "../lib/circleClient.js";
import {
  BASE_DESTINATION_CHAIN,
  SUPPORTED_EVM_CHAINS,
  type SupportedChain,
  USDC_DECIMALS,
  USDC_TOKEN_ADDRESS_BY_CHAIN,
} from "../lib/usdcAddresses.js";
import { bridgeUsdcToBaseForUser } from "../services/bridge.service.js";
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
  data?.circle?.walletsByChain?.[chain]?.walletId as string | undefined;

const main = async () => {
  console.log("[sweep] start", { dryRun, uidFilter, minAmount });

  const userSnap = await firestoreAdmin.collection("users").get();
  for (const doc of userSnap.docs) {
    const uid = doc.id;
    if (uidFilter && uidFilter !== uid) continue;

    const data = doc.data();
    const tasks: Array<{ chain: SupportedChain; amount: string }> = [];

    for (const chain of SUPPORTED_EVM_CHAINS as unknown as SupportedChain[]) {
      if (chain === BASE_DESTINATION_CHAIN) continue;

      const walletId = getWalletId(data, chain);
      if (!walletId) continue;

      const tokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[chain];
      const resp = await circle.getWalletTokenBalance({
        id: walletId,
        tokenAddresses: [tokenAddress],
        includeAll: true,
      });

      const amount = resp.data?.tokenBalances?.[0]?.amount ?? "0";
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
        console.log("[sweep] dry-run", { uid, chain: task.chain, amount: task.amount });
        continue;
      }

      try {
        console.log("[sweep] bridging", { uid, chain: task.chain, amount: task.amount });
        await bridgeUsdcToBaseForUser({
          uid,
          sourceChain: task.chain,
          amount: task.amount,
        });
      } catch (error) {
        console.error("[sweep] bridge failed", {
          uid,
          chain: task.chain,
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
