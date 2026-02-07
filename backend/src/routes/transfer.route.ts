import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import {
  BASE_DESTINATION_CHAIN,
  USDC_TOKEN_ADDRESS_BY_CHAIN,
} from "../lib/usdcAddresses.js";
import { provisionCircleWalletsForUser } from "../services/circle.service.js";

const router = Router();

router.get("/resolve", requireAuth, async (req, res) => {
  try {
    const uid = req.query.uid as string | undefined;
    if (!uid) {
      return res.status(400).json({ message: "Missing uid query param." });
    }

    const snap = await firestoreAdmin.collection("users").doc(uid).get();
    if (!snap.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const data = snap.data() ?? {};
    return res.json({
      uid,
      displayName: (data.displayName as string | undefined) ?? null,
      email: (data.email as string | undefined) ?? null,
    });
  } catch (error) {
    console.error("Resolve recipient failed:", error);
    return res.status(500).json({ message: (error as Error).message });
  }
});

router.post("/send", requireAuth, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { recipientUid, amount } = req.body as {
      recipientUid?: string;
      amount?: string;
    };

    if (!recipientUid || !amount) {
      return res.status(400).json({ message: "Missing transfer parameters." });
    }

    if (recipientUid === user.uid) {
      return res.status(400).json({ message: "Cannot send to yourself." });
    }

    const recipientSnap = await firestoreAdmin.collection("users").doc(recipientUid).get();
    if (!recipientSnap.exists) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    const senderDoc = await provisionCircleWalletsForUser(user.uid);
    const recipientDoc = await provisionCircleWalletsForUser(recipientUid);

    const senderWalletId = senderDoc.walletsByChain?.[BASE_DESTINATION_CHAIN]?.walletId;
    const recipientAddress = recipientDoc.walletsByChain?.[BASE_DESTINATION_CHAIN]?.address;

    if (!senderWalletId) {
      return res.status(400).json({ message: "Sender Base wallet not found." });
    }
    if (!recipientAddress) {
      return res.status(400).json({ message: "Recipient Base wallet not found." });
    }

    const circle = getCircleClient();
    const usdcTokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[BASE_DESTINATION_CHAIN];
    const balances = await circle.getWalletTokenBalance({
      id: senderWalletId,
      tokenAddresses: [usdcTokenAddress],
      includeAll: true,
    });

    const tokenBalance = balances.data?.tokenBalances?.find((entry: any) =>
      (entry?.token?.tokenAddress as string | undefined)?.toLowerCase() ===
      usdcTokenAddress.toLowerCase(),
    );

    const tokenId = tokenBalance?.token?.id as string | undefined;
    if (!tokenId) {
      return res.status(400).json({ message: "USDC tokenId not found for sender wallet." });
    }

    const transfer = await circle.createTransaction({
      walletId: senderWalletId,
      tokenId,
      destinationAddress: recipientAddress,
      amounts: [amount],
      fee: { config: { feeLevel: "LOW" } },
      refId: `p2p:${user.uid}:${recipientUid}:${Date.now()}`,
    } as any);

    const transferId = transfer?.data?.id ?? transfer?.data?.transactionId ?? null;

    await firestoreAdmin
      .collection("users")
      .doc(user.uid)
      .collection("transfers")
      .add({
        type: "OUTGOING",
        recipientUid,
        recipientAddress,
        amount,
        blockchain: BASE_DESTINATION_CHAIN,
        transferId,
        transfer: transfer.data ?? null,
        createdAt: new Date().toISOString(),
      });

    await firestoreAdmin
      .collection("users")
      .doc(recipientUid)
      .collection("transfers")
      .add({
        type: "INCOMING",
        senderUid: user.uid,
        senderWalletId,
        amount,
        blockchain: BASE_DESTINATION_CHAIN,
        transferId,
        transfer: transfer.data ?? null,
        createdAt: new Date().toISOString(),
      });

    return res.json({ transfer: transfer.data, transferId });
  } catch (error) {
    console.error("Send transfer failed:", error);
    return res.status(500).json({ message: (error as Error).message });
  }
});

export default router;
