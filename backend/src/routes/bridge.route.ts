import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import {
  BASE_DESTINATION_CHAIN,
  type SupportedChain,
  USDC_TOKEN_ADDRESS_BY_CHAIN,
} from "../lib/usdcAddresses.js";
import {
  bridgeUsdcFromBaseForUser,
  estimateBridgeUsdcFromBaseForUser,
} from "../services/bridge.service.js";

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

router.post("/estimate", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { destinationChain, recipientAddress, amount } = req.body as {
      destinationChain?: SupportedChain;
      recipientAddress?: string;
      amount?: string;
    };

    if (!destinationChain || !recipientAddress || !amount) {
      return res.status(400).json({ message: "Missing estimate parameters." });
    }

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

router.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { destinationChain, recipientAddress, amount } = req.body as {
      destinationChain?: SupportedChain;
      recipientAddress?: string;
      amount?: string;
    };

    if (!destinationChain || !recipientAddress || !amount) {
      return res.status(400).json({ message: "Missing withdraw parameters." });
    }

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
      const transfer = await circle.createTransaction({
        walletId: baseWalletId,
        tokenAddress: USDC_TOKEN_ADDRESS_BY_CHAIN[BASE_DESTINATION_CHAIN],
        destinationAddress: recipientAddress,
        amounts: [amount],
        feeLevel: "LOW",
      } as any);

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

      return res.json({ transfer: transfer.data });
    }

    const result = await bridgeUsdcFromBaseForUser({
      uid: user.uid,
      destinationChain,
      amount,
      recipientAddress,
    });

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

    return res.json({ result: safeResult });
  } catch (error) {
    console.error("Withdraw failed:", error);
    return res.status(500).json({ message: (error as Error).message });
  }
});

export default router;
