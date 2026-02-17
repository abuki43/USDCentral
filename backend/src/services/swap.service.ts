import admin from "firebase-admin";
import crypto from "crypto";
import { Interface } from "ethers";

import { getCircleClient } from "../lib/circleClient.js";
import { EVM_CHAIN_ID_BY_CIRCLE_CHAIN, isSupportedEvmCircleChain } from "../lib/evmChains.js";
import { lifiGetRoutes, lifiGetStepTransaction } from "../lib/lifiClient.js";
import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import { upsertTransaction } from "../lib/transactions.js";
import { formatDecimalFromBaseUnits, parseBigintMaybeHex } from "../lib/units.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { isCircleTxDone, isCircleTxFailed, toBaseUnits } from "./swap/swapUtils.js";
import {
  SUPPORTED_EVM_CHAINS,
  SUPPORTED_SOL_CHAINS,
  type SupportedChain,
} from "../lib/chains.js";
import { USDC_TOKEN_ADDRESS_BY_CHAIN } from "../lib/usdcAddresses.js";
import { recomputeUnifiedUsdcBalance } from "./circle.service.js";
import { enqueueSwapProcessJob } from "./queue.service.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();


type SwapJobStatus =
  | "QUEUED"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_PENDING"
  | "SWAP_READY"
  | "SWAP_PENDING"
  | "COMPLETED"
  | "FAILED";

type SwapJobDoc = {
  uid: string;
  depositTxId: string;
  walletId: string;
  blockchain: SupportedChain;
  chainId: number;

  fromTokenAddress: string;
  fromTokenSymbol: string | null;
  fromTokenDecimals: number;
  fromAmount: string;
  fromAmountBaseUnits: string;

  toTokenAddress: string;
  toTokenSymbol: "USDC";
  toTokenDecimals: 6;

  lifiRoute?: any;
  lifiStep?: any;
  approvalAddress?: string | null;

  approvalCircleTxId?: string | null;
  swapCircleTxId?: string | null;
  lastCircleTxState?: string | null;

  status: SwapJobStatus;
  error?: string | null;

  processingUntil?: admin.firestore.Timestamp | null;
  createdAt?: admin.firestore.FieldValue;
  updatedAt?: admin.firestore.FieldValue;
};

const logSwapError = (message: string, meta?: Record<string, unknown>) => {
  logger.error(meta ?? {}, `[swap] ${message}`);
};

// Temporary: LI.FI no longer supports testnets 
// Skip auto-swapping on testnet networks .
const AUTO_SWAP_DISABLED_CHAINS = new Set<SupportedChain>([
  ...SUPPORTED_EVM_CHAINS,
  ...SUPPORTED_SOL_CHAINS,
]);

const swapTransactionId = (depositTxId: string) => `swap:${depositTxId}`;

const upsertSwapTransaction = async (
  job: SwapJobDoc,
  status: "PENDING" | "COMPLETED" | "FAILED",
  extra?: { txHash?: string | null; error?: string | null },
) => {
  await upsertTransaction(job.uid, swapTransactionId(job.depositTxId), {
    kind: "SWAP",
    status,
    amount: job.fromAmount,
    symbol: job.fromTokenSymbol,
    blockchain: job.blockchain,
    txHash: extra?.txHash ?? null,
    relatedTxId: job.depositTxId,
    metadata: {
      fromTokenAddress: job.fromTokenAddress,
      fromTokenSymbol: job.fromTokenSymbol,
      toTokenAddress: job.toTokenAddress,
      toTokenSymbol: job.toTokenSymbol,
      error: extra?.error ?? null,
    },
  });
};

const erc20Iface = new Interface(["function approve(address spender, uint256 amount) returns (bool)"]);

const getUserEvmAddress = async (uid: string) => {
  const snap = await firestoreAdmin.collection("users").doc(uid).get();
  const circle = snap.data()?.circle as { evmAddress?: string | null } | undefined;
  const addr = circle?.evmAddress ?? null;
  if (!addr) throw new Error("Missing user EVM address.");
  return addr;
};

const normalizeAddress = (value?: string | null) => (value ?? "").toLowerCase();

const isLpTokenAddress = (tokenAddress?: string | null) => {
  const lpAddress = normalizeAddress(config.CURVE_LP_TOKEN_ADDRESS);
  if (!lpAddress) return false;
  return normalizeAddress(tokenAddress) === lpAddress;
};

const tryLockJob = async (jobRef: admin.firestore.DocumentReference) => {
  const now = admin.firestore.Timestamp.now();
  const lockUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 60_000);

  const locked = await firestoreAdmin.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) return false;
    const data = snap.data() as SwapJobDoc;

    const currentUntil = data.processingUntil;
    if (currentUntil && currentUntil.toMillis() > now.toMillis()) {
      return false;
    }

    tx.set(
      jobRef,
      {
        processingUntil: lockUntil,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });

  return locked;
};

const releaseLock = async (jobRef: admin.firestore.DocumentReference) => {
  await jobRef.set(
    {
      processingUntil: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

const buildSameChainUsdcRoute = async (job: SwapJobDoc) => {
  const routesResp = await lifiGetRoutes({
    fromChainId: job.chainId,
    toChainId: job.chainId,
    fromTokenAddress: job.fromTokenAddress,
    toTokenAddress: job.toTokenAddress,
    fromAmount: job.fromAmountBaseUnits,
    options: {
      slippage: 0.5,
      order: "RECOMMENDED",
    },
  } as any);

  const route = routesResp?.routes?.[0];
  if (!route) throw new Error("No LI.FI routes found.");

  const step = route?.steps?.[0];
  if (!step) throw new Error("No LI.FI steps found for route.");

  const approvalAddress = (step?.estimate?.approvalAddress as string | undefined) ?? null;
  return { route, step, approvalAddress };
};

const submitCircleContractExecution = async (params: {
  walletId: string;
  contractAddress: string;
  callData: string;
  amount?: string;
  refId: string;
}) => {
  const circle = getCircleClient();
  const idempotencyKey = crypto.randomUUID();

  const resp = await (circle as any).createContractExecutionTransaction({
    idempotencyKey,
    walletId: params.walletId,
    contractAddress: params.contractAddress,
    callData: params.callData,
    ...(params.amount ? { amount: params.amount } : {}),
    fee: { config: { feeLevel: "MEDIUM" } },
    refId: params.refId,
  });

  const txId = resp?.data?.transactionId ?? resp?.data?.id;
  if (!txId) {
    throw new Error("Circle did not return transaction id.");
  }
  return txId as string;
};

export const enqueueSameChainSwapToUsdc = async (input: {
  uid: string;
  depositTxId: string;
  walletId: string;
  blockchain: SupportedChain;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  tokenDecimals: number | null;
  amount: string;
}) => {
  if (AUTO_SWAP_DISABLED_CHAINS.has(input.blockchain)) {
    logger.info(
      `[swap] Auto-swap disabled on testnet chain ${input.blockchain}; skipping depositTxId=${input.depositTxId}`,
    );
    return { enqueued: false };
  }

  if (!isSupportedEvmCircleChain(input.blockchain)) return { enqueued: false };
  if (!input.tokenAddress) return { enqueued: false };
  if (input.tokenSymbol?.toUpperCase() === "USDC") return { enqueued: false };
  if (isLpTokenAddress(input.tokenAddress)) {
    logger.info(
      {
        depositTxId: input.depositTxId,
        blockchain: input.blockchain,
        tokenAddress: input.tokenAddress,
        tokenSymbol: input.tokenSymbol,
      },
      "[swap] Skipping auto-swap for LP token",
    );
    return { enqueued: false };
  }

  const fromTokenAddress = input.tokenAddress;

  const chainId = EVM_CHAIN_ID_BY_CIRCLE_CHAIN[input.blockchain];
  if (!chainId) return { enqueued: false };

  const decimals = input.tokenDecimals ?? 18;
  const baseUnits = toBaseUnits(input.amount, decimals).toString();
  const toTokenAddress = USDC_TOKEN_ADDRESS_BY_CHAIN[input.blockchain];

  const jobRef = firestoreAdmin.collection("swapJobs").doc(input.depositTxId);

  await firestoreAdmin.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (snap.exists) return;

    const doc: SwapJobDoc = {
      uid: input.uid,
      depositTxId: input.depositTxId,
      walletId: input.walletId,
      blockchain: input.blockchain,
      chainId,
      fromTokenAddress,
      fromTokenSymbol: input.tokenSymbol,
      fromTokenDecimals: decimals,
      fromAmount: input.amount,
      fromAmountBaseUnits: baseUnits,
      toTokenAddress,
      toTokenSymbol: "USDC",
      toTokenDecimals: 6,
      status: "QUEUED",
      error: null,
      processingUntil: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.create(jobRef, doc as any);
  });

  await upsertSwapTransaction(
    {
      uid: input.uid,
      depositTxId: input.depositTxId,
      walletId: input.walletId,
      blockchain: input.blockchain,
      chainId,
      fromTokenAddress,
      fromTokenSymbol: input.tokenSymbol,
      fromTokenDecimals: decimals,
      fromAmount: input.amount,
      fromAmountBaseUnits: baseUnits,
      toTokenAddress,
      toTokenSymbol: "USDC",
      toTokenDecimals: 6,
      status: "QUEUED",
      error: null,
    } as SwapJobDoc,
    "PENDING",
  );

  await enqueueSwapProcessJob({ depositTxId: input.depositTxId });

  logger.info(
    {
      depositTxId: input.depositTxId,
      uid: input.uid,
      blockchain: input.blockchain,
      fromTokenAddress,
      fromTokenSymbol: input.tokenSymbol,
      fromAmount: input.amount,
    },
    "[swap] Enqueued same-chain swap to USDC",
  );

  return { enqueued: true };
};

const advanceJob = async (jobRef: admin.firestore.DocumentReference, job: SwapJobDoc) => {
  const circle = getCircleClient();

  if (AUTO_SWAP_DISABLED_CHAINS.has(job.blockchain)) {
    const msg = `Auto-swap disabled on testnet chain ${job.blockchain}.`;
    logger.info(
      {
        depositTxId: job.depositTxId,
        uid: job.uid,
        status: job.status,
      },
      `[swap] ${msg} Failing swap job.`,
    );
    await jobRef.set(
      {
        status: "FAILED",
        error: msg,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await upsertSwapTransaction(job, "FAILED", { error: msg });
    return;
  }

  if (job.status === "QUEUED") {
    const { route, step, approvalAddress } = await buildSameChainUsdcRoute(job);
    const nextStatus: SwapJobStatus = approvalAddress ? "APPROVAL_REQUIRED" : "SWAP_READY";
    await jobRef.set(
      {
        lifiRoute: route,
        lifiStep: step,
        approvalAddress,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  if (job.status === "APPROVAL_REQUIRED") {
    if (!job.approvalAddress) {
      await jobRef.set({ status: "SWAP_READY", updatedAt: serverTimestamp() }, { merge: true });
      return;
    }

    const approveData = erc20Iface.encodeFunctionData("approve", [
      job.approvalAddress,
      job.fromAmountBaseUnits,
    ]);

    const approvalCircleTxId = await submitCircleContractExecution({
      walletId: job.walletId,
      contractAddress: job.fromTokenAddress,
      callData: approveData,
      refId: `approve:${job.depositTxId}`,
    });

    await jobRef.set(
      {
        approvalCircleTxId,
        status: "APPROVAL_PENDING",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  if (job.status === "APPROVAL_PENDING") {
    if (!job.approvalCircleTxId) {
      logSwapError("Missing approvalCircleTxId.", {
        depositTxId: job.depositTxId,
        uid: job.uid,
        status: job.status,
      });
      await jobRef.set(
        { status: "FAILED", error: "Missing approvalCircleTxId.", updatedAt: serverTimestamp() },
        { merge: true },
      );
      await upsertSwapTransaction(job, "FAILED", { error: "Missing approvalCircleTxId." });
      return;
    }

    const txResp = await (circle as any).getTransaction({ id: job.approvalCircleTxId });
    const state = (txResp?.data?.transaction?.state as string | undefined) ?? "";
    await jobRef.set({ lastCircleTxState: state, updatedAt: serverTimestamp() }, { merge: true });

    if (isCircleTxFailed(state)) {
      logSwapError("Approval Circle transaction failed.", {
        depositTxId: job.depositTxId,
        uid: job.uid,
        approvalCircleTxId: job.approvalCircleTxId,
        state,
      });
      await jobRef.set(
        {
          status: "FAILED",
          error: `Approval failed: ${state}`,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await upsertSwapTransaction(job, "FAILED", { error: `Approval failed: ${state}` });
      return;
    }

    if (!isCircleTxDone(state)) return;

    await jobRef.set({ status: "SWAP_READY", updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  if (job.status === "SWAP_READY") {
    if (!job.lifiStep) {
      logSwapError("Missing LI.FI step.", {
        depositTxId: job.depositTxId,
        uid: job.uid,
        status: job.status,
      });
      await jobRef.set(
        { status: "FAILED", error: "Missing LI.FI step.", updatedAt: serverTimestamp() },
        { merge: true },
      );
      await upsertSwapTransaction(job, "FAILED", { error: "Missing LI.FI step." });
      return;
    }

    const fromAddress = await getUserEvmAddress(job.uid);
    const toAddress = fromAddress;

    const stepTxResp = await lifiGetStepTransaction({
      step: job.lifiStep,
      fromAddress,
      toAddress,
    } as any);

    const txReq = stepTxResp?.transactionRequest;
    const to = (txReq?.to as string | undefined) ?? null;
    const data = (txReq?.data as string | undefined) ?? null;
    const valueRaw = (txReq?.value as string | undefined) ?? "0";

    if (!to || !data) {
      logSwapError("LI.FI did not return transaction request (to/data).", {
        depositTxId: job.depositTxId,
        uid: job.uid,
        status: job.status,
        hasTo: Boolean(to),
        hasData: Boolean(data),
      });
      await jobRef.set(
        {
          status: "FAILED",
          error: "LI.FI did not return a transaction request (to/data).",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await upsertSwapTransaction(job, "FAILED", {
        error: "LI.FI did not return a transaction request (to/data).",
      });
      return;
    }

    const valueWei = parseBigintMaybeHex(valueRaw);
    const amountNative = valueWei === 0n ? undefined : formatDecimalFromBaseUnits(valueWei, 18);

    const swapCircleTxId = await submitCircleContractExecution({
      walletId: job.walletId,
      contractAddress: to,
      callData: data,
      ...(amountNative ? { amount: amountNative } : {}),
      refId: `swap:${job.depositTxId}`,
    });

    await jobRef.set(
      {
        swapCircleTxId,
        status: "SWAP_PENDING",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  if (job.status === "SWAP_PENDING") {
    if (!job.swapCircleTxId) {
      logSwapError("Missing swapCircleTxId.", {
        depositTxId: job.depositTxId,
        uid: job.uid,
        status: job.status,
      });
      await jobRef.set(
        { status: "FAILED", error: "Missing swapCircleTxId.", updatedAt: serverTimestamp() },
        { merge: true },
      );
      await upsertSwapTransaction(job, "FAILED", { error: "Missing swapCircleTxId." });
      return;
    }

    const txResp = await (circle as any).getTransaction({ id: job.swapCircleTxId });
    const state = (txResp?.data?.transaction?.state as string | undefined) ?? "";
    const txHash = (txResp?.data?.transaction?.txHash as string | undefined) ?? null;
    await jobRef.set({ lastCircleTxState: state, updatedAt: serverTimestamp() }, { merge: true });

    if (isCircleTxFailed(state)) {
      logSwapError("Swap Circle transaction failed.", {
        depositTxId: job.depositTxId,
        uid: job.uid,
        swapCircleTxId: job.swapCircleTxId,
        state,
      });
      await jobRef.set(
        {
          status: "FAILED",
          error: `Swap failed: ${state}`,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await upsertSwapTransaction(job, "FAILED", { error: `Swap failed: ${state}` });
      return;
    }

    if (!isCircleTxDone(state)) return;

    await jobRef.set({ status: "COMPLETED", updatedAt: serverTimestamp() }, { merge: true });
    await upsertSwapTransaction(job, "COMPLETED", { txHash });
    await recomputeUnifiedUsdcBalance(job.uid).catch(() => undefined);
    return;
  }
};

export const processPendingSwapJobsOnce = async (opts?: { limit?: number }) => {
  const limit = opts?.limit ?? 5;
  const statuses: SwapJobStatus[] = [
    "QUEUED",
    "APPROVAL_REQUIRED",
    "APPROVAL_PENDING",
    "SWAP_READY",
    "SWAP_PENDING",
  ];

  const snap = await firestoreAdmin
    .collection("swapJobs")
    .where("status", "in", statuses)
    .limit(limit)
    .get();

  for (const doc of snap.docs) {
    const jobRef = doc.ref;
    const locked = await tryLockJob(jobRef);
    if (!locked) continue;

    try {
      const job = doc.data() as SwapJobDoc;
      await advanceJob(jobRef, job);
    } catch (e) {
      const err = e as Error;
      const current = doc.data() as SwapJobDoc;
      logSwapError("Unhandled exception advancing swap job.", {
        depositTxId: doc.id,
        uid: current.uid,
        status: current.status,
        approvalCircleTxId: current.approvalCircleTxId ?? null,
        swapCircleTxId: current.swapCircleTxId ?? null,
        message: err?.message,
      });
      await jobRef.set(
        {
          status: "FAILED",
          error: err.message,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await upsertSwapTransaction(current, "FAILED", { error: err.message });
    } finally {
      await releaseLock(jobRef).catch(() => undefined);
    }
  }
};
