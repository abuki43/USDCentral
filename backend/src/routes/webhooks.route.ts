import express, { Router } from "express";
import { getCircleClient } from "../lib/circleClient.js";
import { resolveUidFromWalletId } from "../services/circle.service.js";
import { handleCircleWebhookTransaction } from "../services/webhooks.service.js";
import { logger } from "../lib/logger.js";
import { verifyCircleWebhookSignature } from "../lib/webhooks.js";
import { config } from "../config.js";
import { withRetry } from "../lib/retry.js";

const router = Router();
const getWebhookTimestamp = (payload: any) => {
  const candidates = [
    payload?.timestamp,
    payload?.notification?.timestamp,
    payload?.notification?.createdAt,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const ts = Date.parse(value);
    if (!Number.isNaN(ts)) return ts;
  }
  return null;
};


router.post(
  "/circle",
  // Raw body is required for signature verification.
  express.raw({ type: "*/*" }),
  async (req, res, next) => {
    try {
      req.log?.info("Received Circle webhook");
      const keyId = req.header("X-Circle-Key-Id");
      const signature = req.header("X-Circle-Signature");
      if (!keyId || !signature) {
        return res
          .status(400)
          .json({ message: "Missing Circle signature headers." });
      }
      const raw = req.body as Buffer;

      req.log?.info("Verifying webhook signature");
      const valid = await verifyCircleWebhookSignature({
        keyId,
        signature,
        payload: raw,
      });
      if (!valid) {
        return res.status(401).json({ message: "Invalid webhook signature." });
      }

      const payload = JSON.parse(raw.toString("utf-8")) as any;
      req.log?.info(
        {
          notificationType: payload?.notificationType ?? null,
          notificationId: payload?.notificationId ?? null,
          notificationTxId: payload?.notification?.id ?? null,
        },
        "[webhook] notification",
      );
      if (config.webhookReplayWindowSec > 0) {
        const ts = getWebhookTimestamp(payload);
        if (ts) {
          const ageMs = Date.now() - ts;
          if (ageMs > config.webhookReplayWindowSec * 1000) {
            req.log?.warn(
              {
                ageMs,
                windowSec: config.webhookReplayWindowSec,
              },
              "Skipping stale webhook",
            );
            return res.status(200).json({ ok: true });
          }
        }
      }
      if (!payload?.notificationType?.startsWith("transactions.")) {
        return res.status(200).json({ ok: true });
      }

      const txId = payload?.notification?.id as string | undefined;
      if (!txId) {
        return res.status(200).json({ ok: true });
      }

      const circle = getCircleClient();
      const txResp = await withRetry(
        () => circle.getTransaction({ id: txId }),
        { retries: 2 },
      );
      const tx = txResp.data?.transaction as any;
      if (!tx) {
        return res.status(200).json({ ok: true });
      }

      req.log?.info(
        {
          txId: tx.id ?? null,
          transactionType: tx.transactionType ?? null,
          state: tx.state ?? null,
          txHash: tx.txHash ?? null,
          blockchain: tx.blockchain ?? null,
          walletId: tx.walletId ?? null,
        },
        "[webhook] transaction",
      );

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
      logger.error({ err: error }, "Error processing Circle webhook");
      return next(error);
    }
  },
);

export default router;
