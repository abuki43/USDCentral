import admin from "firebase-admin";

import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import {
  HUB_DESTINATION_CHAIN,
  normalizeSupportedChain,
} from "../lib/usdcAddresses.js";
import { upsertTransaction } from "../lib/transactions.js";
import { config } from "../config.js";
import { recomputeUnifiedUsdcBalance } from "./circle.service.js";
import { bridgeUsdcToHubForUser } from "./bridge.service.js";
import { enqueueSameChainSwapToUsdc } from "./swap.service.js";
import { enqueueBridgeToHubJob, type BridgeToHubJob } from "./queue.service.js";
import { refreshCurvePositionForUser } from "./liquidity.service.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const FAILED_STATES = new Set(["FAILED", "CANCELLED", "DENIED", "REJECTED"]);
const DONE_STATES = new Set(["CONFIRMED", "COMPLETE", "COMPLETED"]);


const normalizeState = (state?: string | null) => (state ?? "").toUpperCase();

const isDoneState = (state?: string | null) => DONE_STATES.has(normalizeState(state));

const isFailedState = (state?: string | null) => FAILED_STATES.has(normalizeState(state));

const getAlertRef = (uid: string, docId: string) =>
  firestoreAdmin.collection("users").doc(uid).collection("alerts").doc(docId);

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

const getBridgeDestinationTxHash = (result: any) => {
  const steps = result?.steps ?? result?.result?.steps ?? [];
  if (!Array.isArray(steps)) return null;
  const mintStep = steps.find((step: any) => step?.name === "mint");
  const txHash = mintStep?.txHash ?? mintStep?.data?.txHash ?? null;
  return typeof txHash === "string" ? txHash : null;
};



const getTokenInfo = async (circle: ReturnType<typeof getCircleClient>, tokenId?: string) => {
  if (!tokenId) {
    return {
      symbol: null,
      tokenAddress: null,
      decimals: null,
      isUsdc: false,
    };
  }

  const tokenResp = await circle.getToken({ id: tokenId });
  const token = tokenResp.data?.token as any;
  const symbol = (token?.symbol as string | undefined) ?? null;
  const tokenAddress = (token?.tokenAddress as string | undefined) ?? null;
  const decimals = (token?.decimals as number | undefined) ?? null;
  const isUsdc = symbol?.toUpperCase() === "USDC";

  return { symbol, tokenAddress, decimals, isUsdc };
};

const handleOutboundTransaction = async (params: {
  uid: string;
  tx: any;
  amount: string;
  symbol: string | null;
}) => {
  const { uid, tx, amount, symbol } = params;
  const refId = (tx.refId as string | undefined) ?? "";
  const kind = refId.startsWith("p2p:")
    ? "SEND"
    : refId.startsWith("withdraw:")
      ? "WITHDRAW"
      : null;

  if (!kind) return;

  const status = isFailedState(tx.state)
    ? "FAILED"
    : isDoneState(tx.state)
      ? "CONFIRMED"
      : "PENDING";
  const chain = normalizeSupportedChain(tx.blockchain as string | undefined);

  await upsertTransaction(uid, tx.id, {
    kind,
    status,
    amount,
    symbol,
    blockchain: chain ?? tx.blockchain ?? null,
    txHash: tx.txHash ?? null,
    relatedTxId: tx.id,
    metadata: {
      direction: "OUTGOING",
      recipientAddress: tx.destinationAddress ?? null,
      refId: refId || null,
    },
  });
};

const handleCurveLiquidityExecution = async (params: { tx: any; uid?: string }) => {
  const { tx, uid } = params;
  if (!uid) return;
  const chain = normalizeSupportedChain(tx.blockchain as string | undefined);

  const refId = (tx.refId as string | undefined) ?? "";
  const isDeposit = refId.startsWith("liquidity-deposit:");
  const isWithdraw = refId.startsWith("liquidity-withdraw:");
  if (!isDeposit && !isWithdraw) return;

  const status = isFailedState(tx.state)
    ? "FAILED"
    : isDoneState(tx.state)
      ? "COMPLETED"
      : "PENDING";

  const positionRef = firestoreAdmin
    .collection("users")
    .doc(uid)
    .collection("positions")
    .doc("curve");
  const positionSnap = await positionRef.get();
  const positionData = positionSnap.data() ?? {};

  const amount = isDeposit
    ? (positionData.lastDepositAmount as string | undefined) ?? "0"
    : (positionData.lastWithdrawAmount as string | undefined) ?? "0";

  const txDocId = isDeposit
    ? `earn:curve:deposit:${tx.id}`
    : `earn:curve:withdraw:${tx.id}`;

  await upsertTransaction(uid, txDocId, {
    kind: "EARN",
    status,
    amount,
    symbol: "USDC",
    blockchain: chain ?? HUB_DESTINATION_CHAIN,
    relatedTxId: tx.id,
    txHash: tx.txHash ?? null,
    metadata: {
      action: isDeposit ? "ADD_LIQUIDITY" : "WITHDRAW_LIQUIDITY",
    },
  });

  const positionUpdate: Record<string, unknown> = {
    lastLiquidityTxState: tx.state ?? null,
    updatedAt: serverTimestamp(),
  };
  if (isDeposit) positionUpdate.lastDepositTxHash = tx.txHash ?? null;
  if (isWithdraw) positionUpdate.lastWithdrawTxHash = tx.txHash ?? null;
  if (status === "FAILED") positionUpdate.status = "FAILED";

  await positionRef.set(positionUpdate, { merge: true });

  if (isDoneState(tx.state)) {
    await refreshCurvePositionForUser(uid).catch((error) => {
      console.error("[liquidity] failed to refresh curve position", {
        uid,
        error: (error as Error)?.message,
      });
    });
  }
};

export const processBridgeToHubJob = async (params: BridgeToHubJob) => {
  const { uid, txId, walletId, sourceChain, amount, symbol } = params;
  const normalizedSourceChain = normalizeSupportedChain(sourceChain);

  const depositRef = firestoreAdmin
    .collection("users")
    .doc(uid)
    .collection("deposits")
    .doc(txId);

  try {
    if (!normalizedSourceChain) {
      throw new Error(`Unsupported source chain for bridge job: ${sourceChain}`);
    }
    // Diagnostic: log job context
    console.log("[processBridgeToHubJob] start", {
      uid,
      txId,
      walletId,
      sourceChain,
      normalizedSourceChain,
      hub: HUB_DESTINATION_CHAIN,
      amount,
    });
    if (normalizedSourceChain === HUB_DESTINATION_CHAIN) {
      await depositRef.set(
        {
          bridge: {
            status: "SKIPPED",
            sourceChain: normalizedSourceChain,
            destinationChain: HUB_DESTINATION_CHAIN,
            reason: "Source chain is already hub chain",
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true },
      );
      return;
    }

    const result = await bridgeUsdcToHubForUser({
      uid,
      sourceChain: normalizedSourceChain,
      amount,
    });

    const safeResult = sanitizeForFirestore(result);
    const destinationTxHash = getBridgeDestinationTxHash(result);

    await depositRef.set(
      {
        bridge: {
          status: "COMPLETED",
          sourceChain: normalizedSourceChain,
          destinationChain: HUB_DESTINATION_CHAIN,
          result: safeResult,
          destinationTxHash,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true },
    );

    await upsertTransaction(uid, txId, {
      kind: "DEPOSIT",
      status: "COMPLETED",
      amount,
      symbol,
      blockchain: HUB_DESTINATION_CHAIN,
      sourceChain: normalizedSourceChain,
      destinationChain: HUB_DESTINATION_CHAIN,
      relatedTxId: txId,
      metadata: { bridged: true },
    });

    const alertRef = getAlertRef(uid, "inboundUSDC");
    await alertRef.set(
      {
        txId,
        state: "BRIDGED",
        blockchain: HUB_DESTINATION_CHAIN,
        amount,
        symbol,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await recomputeUnifiedUsdcBalance(uid);
  } catch (error) {
    console.error("Failed to bridge USDC to hub chain", {
      txId,
      uid,
      walletId,
      blockchain: normalizedSourceChain ?? sourceChain,
      error: (error as Error)?.message,
    });

    await depositRef.set(
      {
        bridge: {
          status: "FAILED",
          sourceChain: normalizedSourceChain ?? sourceChain,
          destinationChain: HUB_DESTINATION_CHAIN,
          error: (error as Error)?.message,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true },
    );

    await upsertTransaction(uid, txId, {
      kind: "DEPOSIT",
      status: "FAILED",
      amount,
      symbol,
      blockchain: HUB_DESTINATION_CHAIN,
      sourceChain: normalizedSourceChain ?? sourceChain,
      destinationChain: HUB_DESTINATION_CHAIN,
      relatedTxId: txId,
      metadata: { bridged: true, error: (error as Error)?.message },
    });
  }
};

const handleInboundTransaction = async (params: {
  uid: string;
  tx: any;
  circle: ReturnType<typeof getCircleClient>;
}) => {
  const { uid, tx, circle } = params;
  const amount = (tx.amounts?.[0] as string | undefined) ?? "0";
  const tokenInfo = await getTokenInfo(circle, tx.tokenId as string | undefined);
  const { symbol, tokenAddress, decimals, isUsdc } = tokenInfo;
  const state = normalizeState(tx.state);

  const chain = normalizeSupportedChain((tx.blockchain ?? null) as string | null);
  const isHub = chain === HUB_DESTINATION_CHAIN;
  let depositId = tx.id as string;

  if (isHub && tx.txHash) {
    const bridgedSnap = await firestoreAdmin
      .collection("users")
      .doc(uid)
      .collection("deposits")
      .where("bridge.destinationTxHash", "==", tx.txHash)
      .limit(1)
      .get();

    if (!bridgedSnap.empty && bridgedSnap.docs.length > 0) {
      const [firstDoc] = bridgedSnap.docs;
      if (firstDoc) {
        depositId = firstDoc.id;
      }
    }
  }

  const depositRef = firestoreAdmin
    .collection("users")
    .doc(uid)
    .collection("deposits")
    .doc(depositId);

  await depositRef.set(
    {
      id: depositId,
      walletId: tx.walletId ?? null,
      blockchain: chain ?? tx.blockchain ?? null,
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

  await upsertTransaction(uid, depositId, {
    kind: "DEPOSIT",
    status: state === "CONFIRMED" ? "CONFIRMED" : "PENDING",
    amount,
    symbol,
    blockchain: chain ?? tx.blockchain ?? null,
    txHash: tx.txHash ?? null,
    relatedTxId: tx.id,
  });

  const depositSnap = await depositRef.get();
  const existingBridgeStatus = depositSnap.data()?.bridge?.status as string | undefined;

  const alertRef = getAlertRef(uid, "inboundUSDC");

  if (isUsdc && state === "CONFIRMED") {
    if (isHub) {
      await alertRef.set(
        {
          txId: depositId,
          state,
          blockchain: chain ?? tx.blockchain ?? null,
          amount,
          symbol,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } else if (!existingBridgeStatus || existingBridgeStatus === "FAILED") {
      if (!chain) {
        console.warn("[webhook] skipping auto-bridge for unknown inbound chain", {
          txId: tx.id ?? null,
          uid,
          rawBlockchain: tx.blockchain ?? null,
        });
        return;
      }

      await depositRef.set(
        {
          bridge: {
            status: "PENDING",
            sourceChain: chain,
            destinationChain: HUB_DESTINATION_CHAIN,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true },
      );

      await upsertTransaction(uid, tx.id, {
        kind: "DEPOSIT",
        status: "BRIDGING",
        amount,
        symbol,
        blockchain: HUB_DESTINATION_CHAIN,
        sourceChain: chain,
        destinationChain: HUB_DESTINATION_CHAIN,
        relatedTxId: tx.id,
        metadata: { bridged: true },
      });

      await enqueueBridgeToHubJob(
        {
          uid,
          txId: tx.id as string,
          walletId: tx.walletId ?? null,
          sourceChain: chain,
          amount,
          symbol,
        },
        () => processBridgeToHubJob({
          uid,
          txId: tx.id as string,
          walletId: tx.walletId ?? null,
          sourceChain: chain,
          amount,
          symbol,
        }),
      );
    }
  }

  if (isDoneState(state)) {
    if (isUsdc) {
      await alertRef.delete().catch(() => undefined);
      await recomputeUnifiedUsdcBalance(uid);
    } else if (config.enableNonUsdcSwaps) {
      try {
        await enqueueSameChainSwapToUsdc({
          uid,
          depositTxId: tx.id as string,
          walletId: tx.walletId,
          blockchain: (chain ?? tx.blockchain ?? null) as any,
          tokenSymbol: symbol,
          tokenAddress,
          tokenDecimals: decimals,
          amount,
        });
      } catch (e) {
        console.error("Failed to enqueue same-chain swap to USDC", {
          txId: tx.id,
          uid,
          walletId: tx.walletId ?? null,
          blockchain: chain ?? tx.blockchain ?? null,
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
};

export const handleCircleWebhookTransaction = async (params: {
  uid: string;
  tx: any;
  circle: ReturnType<typeof getCircleClient>;
}) => {
  const { uid, tx, circle } = params;

  if (tx.transactionType === "OUTBOUND") {
    const refId = (tx.refId as string | undefined) ?? "";
    if (refId.startsWith("liquidity-deposit:") || refId.startsWith("liquidity-withdraw:")) {
      await handleCurveLiquidityExecution({ tx, uid });
      return;
    }
    const amount = (tx.amounts?.[0] as string | undefined) ?? "0";
    const tokenInfo = await getTokenInfo(circle, tx.tokenId as string | undefined);
    await handleOutboundTransaction({
      uid,
      tx,
      amount,
      symbol: tokenInfo.symbol,
    });
    return;
  }

  if (tx.transactionType === "CONTRACT_EXECUTION") {
    await handleCurveLiquidityExecution({ tx, uid });
    return;
  }

  await handleInboundTransaction({ uid, tx, circle });
};
