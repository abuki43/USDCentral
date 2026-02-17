import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  resolveRecipientEmailQuerySchema,
  resolveRecipientQuerySchema,
  sendTransferSchema,
} from "../schemas/transfer.schema.js";
import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { upsertTransaction } from "../lib/transactions.js";
import { HUB_DESTINATION_CHAIN } from "../lib/chains.js";
import { USDC_TOKEN_ADDRESS_BY_CHAIN } from "../lib/usdcAddresses.js";
import { getWalletByChain } from "../lib/wallets.js";
import { provisionCircleWalletsForUser, recomputeUnifiedUsdcBalance } from "../services/circle.service.js";

const router = Router();

router.get(
  "/resolve",
  requireAuth,
  validateQuery(resolveRecipientQuerySchema),
  async (req, res, next) => {
  try {
    const { uid } = req.validatedQuery as { uid: string };

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
    return next(error);
  }
  },
);

router.get(
  "/resolve-email",
  requireAuth,
  validateQuery(resolveRecipientEmailQuerySchema),
  async (req, res, next) => {
    try {
      const { email } = req.validatedQuery as { email: string };

      const snap = await firestoreAdmin
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      const doc = snap.docs[0];
      if (!doc) {
        return res.status(404).json({ message: "User not found." });
      }
      const data = doc.data() ?? {};
      return res.json({
        uid: doc.id,
        displayName: (data.displayName as string | undefined) ?? null,
        email: (data.email as string | undefined) ?? null,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post("/send", requireAuth, validateBody(sendTransferSchema), async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { recipientUid, amount } = req.validatedBody as {
      recipientUid: string;
      amount: string;
    };

    if (recipientUid === user.uid) {
      return res.status(400).json({ message: "Cannot send to yourself." });
    }

    const recipientSnap = await firestoreAdmin.collection("users").doc(recipientUid).get();
    if (!recipientSnap.exists) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    const senderDoc = await provisionCircleWalletsForUser(user.uid);
    const recipientDoc = await provisionCircleWalletsForUser(recipientUid);

    const senderWalletId = getWalletByChain(
      senderDoc.walletsByChain,
      HUB_DESTINATION_CHAIN,
    )?.walletId;
    const recipientAddress = getWalletByChain(
      recipientDoc.walletsByChain,
      HUB_DESTINATION_CHAIN,
    )?.address;

    if (!senderWalletId) {
      return res.status(400).json({ message: "Sender hub wallet not found." });
    }
    if (!recipientAddress) {
      return res.status(400).json({ message: "Recipient hub wallet not found." });
    }

    const circle = getCircleClient();
    const usdcTokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[HUB_DESTINATION_CHAIN];
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

    const refId = `p2p:${user.uid}:${recipientUid}:${Date.now()}`;
    const transfer = await circle.createTransaction({
      walletId: senderWalletId,
      tokenId,
      destinationAddress: recipientAddress,
      amounts: [amount],
      fee: { config: { feeLevel: "LOW" } },
      refId,
    } as any);

    const transferData = transfer?.data as any;
    const transferId = transferData?.id ?? transferData?.transactionId ?? null;
    const unifiedId = transferId ?? refId;

    await upsertTransaction(user.uid, unifiedId, {
      kind: "SEND",
      status: "PENDING",
      amount,
      symbol: "USDC",
      blockchain: HUB_DESTINATION_CHAIN,
      relatedTxId: transferId ?? null,
      metadata: {
        direction: "OUTGOING",
        recipientUid,
        recipientAddress,
      },
    });

    await firestoreAdmin
      .collection("users")
      .doc(user.uid)
      .collection("transfers")
      .add({
        type: "OUTGOING",
        recipientUid,
        recipientAddress,
        amount,
        blockchain: HUB_DESTINATION_CHAIN,
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
        blockchain: HUB_DESTINATION_CHAIN,
        transferId,
        transfer: transfer.data ?? null,
        createdAt: new Date().toISOString(),
      });

    await recomputeUnifiedUsdcBalance(user.uid).catch(() => undefined);

    return res.json({ transfer: transfer.data, transferId });
  } catch (error) {
    return next(error);
  }
});

export default router;
