import crypto from "crypto";
import express, { Router } from "express";
import admin from "firebase-admin";

import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { BASE_DESTINATION_CHAIN } from "../lib/usdcAddresses.js";
import {
  recomputeUnifiedUsdcBalance,
  resolveUidFromWalletId,
} from "../services/circle.service.js";
import { bridgeUsdcToBaseForUser } from "../services/bridge.service.js";
import { enqueueSameChainSwapToUsdc } from "../services/swap.service.js";

const router = Router();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const enableNonUsdcSwaps = process.env.ENABLE_NON_USDC_SWAPS === "true";

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

      if (tx.transactionType !== "INBOUND") {
        return res.status(200).json({ ok: true });
      }

      const walletId = tx.walletId as string | undefined;
      if (!walletId) {
        return res.status(200).json({ ok: true });
      }

      const uid = await resolveUidFromWalletId(walletId);
      if (!uid) {
        return res.status(200).json({ ok: true });
      }

      const tokenId = tx.tokenId as string | undefined;
      if (!tokenId) {
        return res.status(200).json({ ok: true });
      }

      const tokenResp = await circle.getToken({ id: tokenId });
      const token = tokenResp.data?.token as any;
      const symbol = (token?.symbol as string | undefined) ?? null;
      const tokenAddress = (token?.tokenAddress as string | undefined) ?? null;
      const decimals = (token?.decimals as number | undefined) ?? null;
      const isUsdc = symbol?.toUpperCase() === "USDC";

      const state = (tx.state as string | undefined) ?? "";
      const amount = (tx.amounts?.[0] as string | undefined) ?? "0";

      await firestoreAdmin
        .collection("users")
        .doc(uid)
        .collection("deposits")
        .doc(txId)
        .set(
          {
            id: txId,
            walletId,
            blockchain: tx.blockchain ?? null,
            txHash: tx.txHash ?? null,
            state,
            symbol,
            tokenAddress,
            decimals,
            amount,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );

      const depositRef = firestoreAdmin
        .collection("users")
        .doc(uid)
        .collection("deposits")
        .doc(txId);

      const depositSnap = await depositRef.get();
      const existingBridgeStatus = depositSnap.data()?.bridge?.status as
        | string
        | undefined;

      const alertRef = firestoreAdmin
        .collection("users")
        .doc(uid)
        .collection("alerts")
        .doc("inboundUSDC");

      if (isUsdc && state === "CONFIRMED") {
        const chain = (tx.blockchain ?? null) as string | null;
        const isBase = chain === BASE_DESTINATION_CHAIN;

        if (isBase) {
          await alertRef.set(
            {
              txId,
              state,
              blockchain: tx.blockchain ?? null,
              amount,
              symbol,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } else if (!existingBridgeStatus || existingBridgeStatus === "FAILED") {
          await depositRef.set(
            {
              bridge: {
                status: "PENDING",
                sourceChain: tx.blockchain ?? null,
                destinationChain: BASE_DESTINATION_CHAIN,
                updatedAt: serverTimestamp(),
              },
            },
            { merge: true },
          );

          setImmediate(() => {
            bridgeUsdcToBaseForUser({
              uid,
              sourceChain: tx.blockchain as any,
              amount,
            })
              .then(async (result) => {
                await depositRef.set(
                  {
                    bridge: {
                      status: "COMPLETED",
                      sourceChain: tx.blockchain ?? null,
                      destinationChain: BASE_DESTINATION_CHAIN,
                      result,
                      updatedAt: serverTimestamp(),
                    },
                  },
                  { merge: true },
                );

                await alertRef.set(
                  {
                    txId,
                    state: "BRIDGED",
                    blockchain: BASE_DESTINATION_CHAIN,
                    amount,
                    symbol,
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true },
                );

                await recomputeUnifiedUsdcBalance(uid);
              })
              .catch(async (error) => {
                console.error("Failed to bridge USDC to Base", {
                  txId,
                  uid,
                  walletId,
                  blockchain: tx.blockchain ?? null,
                  error: (error as Error)?.message,
                });

                await depositRef.set(
                  {
                    bridge: {
                      status: "FAILED",
                      sourceChain: tx.blockchain ?? null,
                      destinationChain: BASE_DESTINATION_CHAIN,
                      error: (error as Error)?.message,
                      updatedAt: serverTimestamp(),
                    },
                  },
                  { merge: true },
                );
              });
          });
        }
      }

      if (state === "COMPLETE" || state === "COMPLETED") {
        if (isUsdc) {
          await alertRef.delete().catch(() => undefined);
          await recomputeUnifiedUsdcBalance(uid);
        } else if (enableNonUsdcSwaps) {
          try {
            await enqueueSameChainSwapToUsdc({
              uid,
              depositTxId: txId,
              walletId,
              blockchain: (tx.blockchain ?? null) as any,
              tokenSymbol: symbol,
              tokenAddress,
              tokenDecimals: decimals,
              amount,
            });
          } catch (e) {
            console.error("Failed to enqueue same-chain swap to USDC", {
              txId,
              uid,
              walletId,
              blockchain: tx.blockchain ?? null,
              state,
              amount,
              symbol,
              tokenAddress,
              decimals,
              error: (e as Error)?.message,
            });
          }
        }
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
    console.error("Error processing Circle webhook:", error);
      return res.status(500).json({ message: (error as Error).message });
    }
  },
);

export default router;
