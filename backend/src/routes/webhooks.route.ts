import crypto from "crypto";
import express, { Router } from "express";
import { getCircleClient } from "../lib/circleClient.js";
import { resolveUidFromWalletId } from "../services/circle.service.js";
import { handleCircleWebhookTransaction } from "../services/webhooks.service.js";

const router = Router();

const publicKeyCache = new Map<string, crypto.KeyObject>();

async function getCachedPublicKey(keyId: string) {
  const cached = publicKeyCache.get(keyId);
  if (cached) return cached;

  const circle = getCircleClient();
  // Circle docs refer to this header as key id; SDK method name uses “subscriptionId”.
  const resp = await circle.getNotificationSignature(keyId);
  const publicKeyBase64 = resp.data?.publicKey;
  if (!publicKeyBase64) {
    throw new Error("Missing publicKey from Circle.");
  }

  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64");
  const key = crypto.createPublicKey({
    key: publicKeyBytes,
    format: "der",
    type: "spki",
  });

  publicKeyCache.set(keyId, key);
  return key;
}


router.post(
  "/circle",
  // Raw body is required for signature verification.
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      console.log("Received Circle webhook");
      const keyId = req.header("X-Circle-Key-Id");
      const signature = req.header("X-Circle-Signature");
      if (!keyId || !signature) {
        return res
          .status(400)
          .json({ message: "Missing Circle signature headers." });
      }

      const publicKey = await getCachedPublicKey(keyId);
      const signatureBytes = Buffer.from(signature, "base64");
      const raw = req.body as Buffer;

      console.log("Verifying webhook signature");

      const valid = crypto.verify("sha256", raw, publicKey, signatureBytes);
      if (!valid) {
        return res.status(401).json({ message: "Invalid webhook signature." });
      }

      const payload = JSON.parse(raw.toString("utf-8")) as any;
      if (!payload?.notificationType?.startsWith("transactions.")) {
        return res.status(200).json({ ok: true });
      }

      const txId = payload?.notification?.id as string | undefined;
      if (!txId) {
        return res.status(200).json({ ok: true });
      }

      const circle = getCircleClient();
      const txResp = await circle.getTransaction({ id: txId });
      const tx = txResp.data?.transaction as any;
      if (!tx) {
        return res.status(200).json({ ok: true });
      }

      if (
        tx.transactionType !== "INBOUND" &&
        tx.transactionType !== "OUTBOUND" &&
        tx.transactionType !== "CONTRACT_EXECUTION"
      ) {
        return res.status(200).json({ ok: true });
      }

      const walletId = tx.walletId as string | undefined;
      if (!walletId) return res.status(200).json({ ok: true });

      const uid = await resolveUidFromWalletId(walletId);
      if (!uid) {
        return res.status(200).json({ ok: true });
      }
      await handleCircleWebhookTransaction({ uid, tx, circle });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error processing Circle webhook:", error);
      return res.status(500).json({ message: (error as Error).message });
    }
  },
);

export default router;
