import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export type BridgeToBaseJob = {
  uid: string;
  txId: string;
  walletId: string | null;
  sourceChain: string;
  amount: string;
  symbol: string | null;
};

export type SwapProcessJob = {
  depositTxId: string;
};

const isQueueEnabled = () => Boolean(config.REDIS_URL);

const getConnection = () => new Redis(config.REDIS_URL as string, { maxRetriesPerRequest: null });

let bridgeQueue: Queue<BridgeToBaseJob> | null = null;
let swapQueue: Queue<SwapProcessJob> | null = null;

const ensureQueues = () => {
  if (!isQueueEnabled()) return;
  if (!bridgeQueue) {
    bridgeQueue = new Queue<BridgeToBaseJob>("bridgeToBase", { connection: getConnection() });
  }
  if (!swapQueue) {
    swapQueue = new Queue<SwapProcessJob>("swapProcess", { connection: getConnection() });
  }
};

export const enqueueBridgeToBaseJob = async (
  data: BridgeToBaseJob,
  fallback: () => void | Promise<void>,
) => {
  if (!isQueueEnabled()) {
    await fallback();
    return;
  }

  ensureQueues();
  if (!bridgeQueue) {
    await fallback();
    return;
  }

  try {
    await bridgeQueue.add("bridge", data, { jobId: `bridge:${data.txId}` });
  } catch (error) {
    logger.error({ err: error }, "Failed to enqueue bridge job, falling back");
    await fallback();
  }
};

export const enqueueSwapProcessJob = async (
  data: SwapProcessJob,
  fallback?: () => void | Promise<void>,
) => {
  if (!isQueueEnabled()) {
    if (fallback) await fallback();
    return;
  }

  ensureQueues();
  if (!swapQueue) {
    if (fallback) await fallback();
    return;
  }

  try {
    await swapQueue.add("swap", data, { jobId: `swap:${data.depositTxId}` });
  } catch (error) {
    logger.error({ err: error }, "Failed to enqueue swap job");
    if (fallback) await fallback();
  }
};

export const startQueueWorkers = async (handlers: {
  bridgeToBase: (job: BridgeToBaseJob) => Promise<void>;
  swapProcess: (job: SwapProcessJob) => Promise<void>;
}) => {
  if (!isQueueEnabled()) return;

  const connection = getConnection();

  new Worker<BridgeToBaseJob>(
    "bridgeToBase",
    async (job: Job<BridgeToBaseJob>) => handlers.bridgeToBase(job.data),
    { connection },
  ).on("failed", (job: Job<BridgeToBaseJob> | undefined, err: Error) => {
    logger.error({ err, jobId: job?.id }, "Bridge queue job failed");
  });

  new Worker<SwapProcessJob>(
    "swapProcess",
    async (job: Job<SwapProcessJob>) => handlers.swapProcess(job.data),
    { connection },
  ).on("failed", (job: Job<SwapProcessJob> | undefined, err: Error) => {
    logger.error({ err, jobId: job?.id }, "Swap queue job failed");
  });
};

export const queueEnabled = isQueueEnabled;
