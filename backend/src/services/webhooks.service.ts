import admin from "firebase-admin";
import { ethers } from "ethers";

import { getCircleClient } from "../lib/circleClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { BASE_DESTINATION_CHAIN } from "../lib/usdcAddresses.js";
import { upsertTransaction } from "../lib/transactions.js";
import { config } from "../config.js";
import { recomputeUnifiedUsdcBalance } from "./circle.service.js";
import { bridgeUsdcToBaseForUser } from "./bridge.service.js";
import { enqueueSameChainSwapToUsdc } from "./swap.service.js";
import { enqueueBridgeToBaseJob, type BridgeToBaseJob } from "./queue.service.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const FAILED_STATES = new Set(["FAILED", "CANCELLED", "DENIED", "REJECTED"]);
const DONE_STATES = new Set(["CONFIRMED", "COMPLETE", "COMPLETED"]);

const positionManagerAddress = config.UNISWAP_V3_POSITION_MANAGER_ADDRESS;
const baseSepoliaRpcUrl = config.BASE_SEPOLIA_RPC_URL;

const erc721Iface = new ethers.Interface([
  "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
]);

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

const parseLiquidityRefId = (refId: string) => {
  const parts = refId.split(":");
  return {
    kind: parts[0] ?? null,
    uid: parts[1] ?? null,
    positionId: parts[2] ?? null,
  };
};

const handleLiquidityCollect = async (params: { uid: string; tx: any }) => {
  const { uid, tx } = params;
  const refId = (tx.refId as string | undefined) ?? "";
  const parsed = parseLiquidityRefId(refId);
  const positionId = parsed.positionId;
  if (!positionId) return;

  const status = isFailedState(tx.state)
    ? "FAILED"
    : isDoneState(tx.state)
      ? "COMPLETED"
      : "PENDING";

  await upsertTransaction(uid, `earn:${positionId}:collect`, {
    kind: "EARN",
    status,
    amount: "0",
    symbol: "USDC",
    blockchain: tx.blockchain ?? null,
    relatedTxId: tx.id,
    txHash: tx.txHash ?? null,
    metadata: {
      action: "COLLECT_FEES",
      positionId,
    },
  });

  if (isDoneState(tx.state)) {
    await firestoreAdmin
      .collection("users")
      .doc(uid)
      .collection("positions")
      .doc(positionId)
      .set(
        {
          lastCollectAt: serverTimestamp(),
          status: "ACTIVE",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
  }
};

const handleLiquidityDecrease = async (params: { uid: string; tx: any }) => {
  const { uid, tx } = params;
  const refId = (tx.refId as string | undefined) ?? "";
  const parsed = parseLiquidityRefId(refId);
  const positionId = parsed.positionId;
  if (!positionId) return;

  const status = isFailedState(tx.state)
    ? "FAILED"
    : isDoneState(tx.state)
      ? "COMPLETED"
      : "PENDING";

  await upsertTransaction(uid, `earn:${positionId}:withdraw`, {
    kind: "EARN",
    status,
    amount: "0",
    symbol: "USDC",
    blockchain: tx.blockchain ?? null,
    relatedTxId: tx.id,
    txHash: tx.txHash ?? null,
    metadata: {
      action: "WITHDRAW_LIQUIDITY",
      positionId,
    },
  });

  if (isDoneState(tx.state)) {
    await firestoreAdmin
      .collection("users")
      .doc(uid)
      .collection("positions")
      .doc(positionId)
      .delete();
  }
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

  await upsertTransaction(uid, tx.id, {
    kind,
    status,
    amount,
    symbol,
    blockchain: tx.blockchain ?? null,
    txHash: tx.txHash ?? null,
    relatedTxId: tx.id,
    metadata: {
      direction: "OUTGOING",
      recipientAddress: tx.destinationAddress ?? null,
      refId: refId || null,
    },
  });
};

const handleContractExecution = async (params: { tx: any; uid?: string }) => {
  const { tx, uid } = params;
  const isComplete = isDoneState(tx.state);
  if (!isComplete || !tx.txHash || !positionManagerAddress || !baseSepoliaRpcUrl) {
    console.warn("[liquidity] contract execution skipped", {
      txId: tx.id,
      state: tx.state ?? null,
      isComplete,
      hasTxHash: Boolean(tx.txHash),
      hasPositionManagerAddress: Boolean(positionManagerAddress),
      hasBaseSepoliaRpcUrl: Boolean(baseSepoliaRpcUrl),
    });
    return;
  }

  console.info("[liquidity] contract execution started", {
    txId: tx.id,
    state: tx.state ?? null,
    txHash: tx.txHash ?? null,
    positionManagerAddress,
  });

  try {
    const provider = new ethers.JsonRpcProvider(baseSepoliaRpcUrl);
    const receipt = await provider.getTransactionReceipt(tx.txHash as string);
    if (!receipt) {
      console.warn("[liquidity] receipt not found", {
        txId: tx.id,
        txHash: tx.txHash ?? null,
      });
      return;
    }

    console.info("[liquidity] receipt fetched", {
      txId: tx.id,
      txHash: tx.txHash ?? null,
      logsCount: receipt.logs?.length ?? 0,
    });

    const tokenIds: string[] = [];
    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== positionManagerAddress.toLowerCase()) continue;
      try {
        const parsed = erc721Iface.parseLog(log);
        if (parsed?.name === "Transfer" && parsed?.args?.tokenId != null) {
          tokenIds.push(parsed.args.tokenId.toString());
        }
      } catch {
        // ignore non-matching logs
      }
    }

    if (tokenIds.length === 0) return;

    console.info("[liquidity] token ids extracted", {
      txId: tx.id,
      txHash: tx.txHash ?? null,
      tokenIds,
    });

    let snap;
    try {
      if (uid) {
        snap = await firestoreAdmin
          .collection("users")
          .doc(uid)
          .collection("positions")
          .where("mintCircleTxId", "==", tx.id)
          .get();
      } else {
        snap = await firestoreAdmin
          .collectionGroup("positions")
          .where("mintCircleTxId", "==", tx.id)
          .get();
      }
    } catch (error) {
      console.error("[liquidity] position lookup failed", {
        txId: tx.id,
        uid: uid ?? null,
        error: (error as Error)?.message,
      });
      throw error;
    }

    console.info("[liquidity] positions matched", {
      txId: tx.id,
      uid: uid ?? null,
      matches: snap.size,
    });

    const updates = snap.docs.map((doc, index) =>
      doc.ref.set(
        {
          tokenId: tokenIds[index] ?? tokenIds[0],
          mintTxHash: tx.txHash ?? null,
          status: "ACTIVE",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    await Promise.all(updates);
  } catch (error) {
    console.error("Failed to resolve mint tokenId", {
      txId: tx.id,
      txHash: tx.txHash ?? null,
      error: (error as Error)?.message,
    });
  }
};

export const processBridgeToBaseJob = async (params: BridgeToBaseJob) => {
  const { uid, txId, walletId, sourceChain, amount, symbol } = params;

  const depositRef = firestoreAdmin
    .collection("users")
    .doc(uid)
    .collection("deposits")
    .doc(txId);

  try {
    const result = await bridgeUsdcToBaseForUser({
      uid,
      sourceChain: sourceChain as any,
      amount,
    });

    const safeResult = sanitizeForFirestore(result);
    const destinationTxHash = getBridgeDestinationTxHash(result);

    await depositRef.set(
      {
        bridge: {
          status: "COMPLETED",
          sourceChain,
          destinationChain: BASE_DESTINATION_CHAIN,
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
      blockchain: BASE_DESTINATION_CHAIN,
      sourceChain,
      destinationChain: BASE_DESTINATION_CHAIN,
      relatedTxId: txId,
      metadata: { bridged: true },
    });

    const alertRef = getAlertRef(uid, "inboundUSDC");
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
  } catch (error) {
    console.error("Failed to bridge USDC to Base", {
      txId,
      uid,
      walletId,
      blockchain: sourceChain,
      error: (error as Error)?.message,
    });

    await depositRef.set(
      {
        bridge: {
          status: "FAILED",
          sourceChain,
          destinationChain: BASE_DESTINATION_CHAIN,
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
      blockchain: BASE_DESTINATION_CHAIN,
      sourceChain,
      destinationChain: BASE_DESTINATION_CHAIN,
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

  const chain = (tx.blockchain ?? null) as string | null;
  const isBase = chain === BASE_DESTINATION_CHAIN;
  let depositId = tx.id as string;

  if (isBase && tx.txHash) {
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

  await upsertTransaction(uid, depositId, {
    kind: "DEPOSIT",
    status: state === "CONFIRMED" ? "CONFIRMED" : "PENDING",
    amount,
    symbol,
    blockchain: tx.blockchain ?? null,
    txHash: tx.txHash ?? null,
    relatedTxId: tx.id,
  });

  const depositSnap = await depositRef.get();
  const existingBridgeStatus = depositSnap.data()?.bridge?.status as string | undefined;

  const alertRef = getAlertRef(uid, "inboundUSDC");

  if (isUsdc && state === "CONFIRMED") {
    if (isBase) {
      await alertRef.set(
        {
          txId: depositId,
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

      await upsertTransaction(uid, tx.id, {
        kind: "DEPOSIT",
        status: "BRIDGING",
        amount,
        symbol,
        blockchain: BASE_DESTINATION_CHAIN,
        sourceChain: tx.blockchain ?? null,
        destinationChain: BASE_DESTINATION_CHAIN,
        relatedTxId: tx.id,
        metadata: { bridged: true },
      });

      await enqueueBridgeToBaseJob(
        {
          uid,
          txId: tx.id as string,
          walletId: tx.walletId ?? null,
          sourceChain: tx.blockchain ?? "",
          amount,
          symbol,
        },
        () => processBridgeToBaseJob({
          uid,
          txId: tx.id as string,
          walletId: tx.walletId ?? null,
          sourceChain: tx.blockchain ?? "",
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
          blockchain: (tx.blockchain ?? null) as any,
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
};

export const handleCircleWebhookTransaction = async (params: {
  uid: string;
  tx: any;
  circle: ReturnType<typeof getCircleClient>;
}) => {
  const { uid, tx, circle } = params;

  if (tx.transactionType === "OUTBOUND") {
    const refId = (tx.refId as string | undefined) ?? "";
    if (refId.startsWith("liquidity-mint:")) {
      await handleContractExecution({ tx, uid });
      return;
    }
    if (refId.startsWith("liquidity-collect:")) {
      await handleLiquidityCollect({ uid, tx });
      return;
    }
    if (refId.startsWith("liquidity-decrease:")) {
      await handleLiquidityDecrease({ uid, tx });
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
    await handleContractExecution({ tx, uid });
    return;
  }

  await handleInboundTransaction({ uid, tx, circle });
};
