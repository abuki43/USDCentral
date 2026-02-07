import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";
import { bridgeEstimateSchema, bridgeWithdrawSchema } from "../schemas/bridge.schema.js";
import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { upsertTransaction } from "../lib/transactions.js";
import {
  BASE_DESTINATION_CHAIN,
  type SupportedChain,
  USDC_TOKEN_ADDRESS_BY_CHAIN,
} from "../lib/usdcAddresses.js";
import {
  bridgeUsdcFromBaseForUser,
  estimateBridgeUsdcFromBaseForUser,
} from "../services/bridge.service.js";
import { recomputeUnifiedUsdcBalance } from "../services/circle.service.js";

const router = Router();

const sanitizeForFirestore = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Error) {
        return {
          name: v.name,
          message: v.message,
          stack: v.stack,
        };
      }
      return v;
    }),
  );

router.post("/estimate", requireAuth, validateBody(bridgeEstimateSchema), async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { destinationChain, recipientAddress, amount } = req.validatedBody as {
      destinationChain: SupportedChain;
      recipientAddress: string;
      amount: string;
    };

    if (destinationChain === BASE_DESTINATION_CHAIN) {
      return res.json({ estimate: null, fees: [] });
    }

    const estimate = await estimateBridgeUsdcFromBaseForUser({
      uid: user.uid,
      destinationChain,
      amount,
      recipientAddress,
    });

    const safeEstimate = JSON.parse(
      JSON.stringify(estimate, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    return res.json({ estimate: safeEstimate });
  } catch (error) {
    console.error("Estimate failed:", error);
    return res.status(500).json({ message: (error as Error).message });
  }
});

router.post("/withdraw", requireAuth, validateBody(bridgeWithdrawSchema), async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { destinationChain, recipientAddress, amount } = req.validatedBody as {
      destinationChain: SupportedChain;
      recipientAddress: string;
      amount: string;
    };

    const userSnap = await firestoreAdmin.collection("users").doc(user.uid).get();
    const walletsByChain = (userSnap.data()?.circle?.walletsByChain ?? {}) as Record<
      string,
      { walletId?: string; address?: string }
    >;

    if (destinationChain === BASE_DESTINATION_CHAIN) {
      const baseWalletId = walletsByChain[BASE_DESTINATION_CHAIN]?.walletId;
      if (!baseWalletId) {
        return res.status(400).json({ message: "Missing Base wallet for user." });
      }

      const circle = getCircleClient();
      const usdcTokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[BASE_DESTINATION_CHAIN];
      const balances = await circle.getWalletTokenBalance({
        id: baseWalletId,
        tokenAddresses: [usdcTokenAddress],
        includeAll: true,
      });

      const tokenBalance = balances.data?.tokenBalances?.find((entry: any) =>
        (entry?.token?.tokenAddress as string | undefined)?.toLowerCase() ===
        usdcTokenAddress.toLowerCase(),
      );

      const tokenId = tokenBalance?.token?.id as string | undefined;
      if (!tokenId) {
        return res.status(400).json({ message: "USDC tokenId not found for Base wallet." });
      }

      const refId = `withdraw:${user.uid}:${Date.now()}`;
      const transfer = await circle.createTransaction({
        walletId: baseWalletId,
        tokenId,
        destinationAddress: recipientAddress,
        amounts: [amount],
        fee: { config: { feeLevel: "LOW" } },
        refId,
      } as any);

      const transferId = transfer?.data?.id ?? null;
      const unifiedId = transferId ?? refId;

      await upsertTransaction(user.uid, unifiedId, {
        kind: "WITHDRAW",
        status: "PENDING",
        amount,
        symbol: "USDC",
        blockchain: BASE_DESTINATION_CHAIN,
        relatedTxId: transferId ?? null,
        metadata: {
          destinationChain,
          recipientAddress,
          type: "DIRECT",
        },
      });

      await firestoreAdmin
        .collection("users")
        .doc(user.uid)
        .collection("withdrawals")
        .add({
          destinationChain,
          recipientAddress,
          amount,
          type: "DIRECT",
          transfer: sanitizeForFirestore(transfer),
          createdAt: new Date().toISOString(),
        });

      await recomputeUnifiedUsdcBalance(user.uid).catch(() => undefined);
      return res.json({ transfer: transfer.data });
    }

    const withdrawId = `withdraw:${user.uid}:${Date.now()}`;
    await upsertTransaction(user.uid, withdrawId, {
      kind: "WITHDRAW",
      status: "BRIDGING",
      amount,
      symbol: "USDC",
      blockchain: BASE_DESTINATION_CHAIN,
      sourceChain: BASE_DESTINATION_CHAIN,
      destinationChain,
      metadata: {
        recipientAddress,
        type: "BRIDGE",
      },
    });

    let result: unknown;
    try {
      result = await bridgeUsdcFromBaseForUser({
        uid: user.uid,
        destinationChain,
        amount,
        recipientAddress,
      });
    } catch (error) {
      await upsertTransaction(user.uid, withdrawId, {
        kind: "WITHDRAW",
        status: "FAILED",
        amount,
        symbol: "USDC",
        blockchain: BASE_DESTINATION_CHAIN,
        sourceChain: BASE_DESTINATION_CHAIN,
        destinationChain,
        metadata: {
          recipientAddress,
          type: "BRIDGE",
          error: (error as Error).message,
        },
      });
      throw error;
    }

    const safeResult = sanitizeForFirestore(result);

    await firestoreAdmin
      .collection("users")
      .doc(user.uid)
      .collection("withdrawals")
      .add({
        destinationChain,
        recipientAddress,
        amount,
        type: "BRIDGE",
        result: safeResult,
        createdAt: new Date().toISOString(),
      });

    await upsertTransaction(user.uid, withdrawId, {
      kind: "WITHDRAW",
      status: "COMPLETED",
      amount,
      symbol: "USDC",
      blockchain: BASE_DESTINATION_CHAIN,
      sourceChain: BASE_DESTINATION_CHAIN,
      destinationChain,
      metadata: {
        recipientAddress,
        type: "BRIDGE",
        result: safeResult,
      },
    });

    await recomputeUnifiedUsdcBalance(user.uid).catch(() => undefined);

    return res.json({ result: safeResult });
  } catch (error) {
    console.error("Withdraw failed:", error);
    return res.status(500).json({ message: (error as Error).message });
  }
});

export default router;
