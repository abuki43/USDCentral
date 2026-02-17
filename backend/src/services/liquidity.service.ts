import admin from "firebase-admin";
import crypto from "crypto";
import { ethers } from "ethers";

import { HUB_DESTINATION_CHAIN } from "../lib/chains.js";
import { USDC_DECIMALS, USDC_TOKEN_ADDRESS_BY_CHAIN } from "../lib/usdcAddresses.js";
import { getWalletByChain } from "../lib/wallets.js";
import { getCircleClient } from "../lib/circleClient.js";
import { upsertTransaction } from "../lib/transactions.js";
import { logger } from "../lib/logger.js";
import { withRetry } from "../lib/retry.js";
import { getCurvePositionRef } from "../repos/positionsRepo.js";
import { getUserCircleWalletsByChain } from "../repos/usersRepo.js";
import {
  curvePoolIface,
  erc20ReadAbi,
  ensureCurvePoolVerified,
  getCurveConfig,
  getProvider,
} from "./liquidity/curveConfig.js";
import {
  buildAddLiquidityArgs,
  buildCalcTokenAmountArgs,
  buildRemoveOneCoinArgs,
  getAddLiquidityCandidates,
  getCalcTokenAmountCandidates,
  getErrorMessage,
  getRemoveOneCoinCandidates,
  getSelectorForSignature,
  isLikelyStateDependentRevert,
  prioritizeCachedSignature,
} from "./liquidity/curveSignatures.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const USDC_AMOUNT_REGEX = /^\d+(\.\d{1,6})?$/;

const toBaseUnits = (amount: string, decimals: number) => {
  const [whole, fractionRaw = ""] = amount.split(".");
  const fraction = fractionRaw.padEnd(decimals, "0").slice(0, decimals);
  const normalizedWhole = (whole ?? "0").replace(/^0+(?=\d)/, "") || "0";
  const normalized = `${normalizedWhole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(normalized);
};

const parseUsdcAmountToBaseUnits = (rawAmount: string) => {
  const amount = rawAmount.trim();
  if (!USDC_AMOUNT_REGEX.test(amount)) {
    throw new Error("Amount must be a positive USDC amount with up to 6 decimals.");
  }

  const value = toBaseUnits(amount, USDC_DECIMALS);
  if (value <= 0n) {
    throw new Error("Amount must be greater than 0.");
  }
  return value;
};

const fromBaseUnits = (value: bigint, decimals: number) => {
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const fraction = s.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};

const applySlippage = (amount: bigint, slippageBps: number) => {
  if (slippageBps <= 0) return amount;
  const numerator = BigInt(10000 - slippageBps);
  return (amount * numerator) / 10000n;
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

const erc20Iface = new ethers.Interface([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

type CurveMethodCacheEntry = {
  calcTokenAmountSig?: string;
  addLiquiditySig?: string;
  removeOneCoinSig?: string;
};

const curveMethodCache = new Map<string, CurveMethodCacheEntry>();

const getCurveMethodCacheKey = (poolAddress: string, poolSize: number) =>
  `${poolAddress.toLowerCase()}:${poolSize}`;

const getCurveMethodCacheEntry = (poolAddress: string, poolSize: number) => {
  const key = getCurveMethodCacheKey(poolAddress, poolSize);
  const cached = curveMethodCache.get(key);
  if (cached) return cached;
  const empty: CurveMethodCacheEntry = {};
  curveMethodCache.set(key, empty);
  return empty;
};

const waitForCircleTxCompletion = async (params: {
  txId: string;
  label: string;
  maxAttempts?: number;
  delayMs?: number;
}) => {
  const { txId, label, maxAttempts = 12, delayMs = 5000 } = params;
  const circle = getCircleClient();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const txResp = (await withRetry(
      () => (circle as any).getTransaction({ id: txId }),
      { retries: 2 },
    )) as any;
    const tx = txResp?.data?.transaction as any;
    const state = (tx?.state as string | undefined) ?? null;
    const txHash = (tx?.txHash as string | undefined) ?? null;

    logger.info(
      {
        label,
        txId,
        attempt,
        state,
        txHash,
      },
      "[liquidity] circle tx status",
    );

    if (state && ["CONFIRMED", "COMPLETE", "COMPLETED"].includes(state)) {
      return { state, txHash };
    }

    if (state && ["FAILED", "CANCELLED", "DENIED", "REJECTED"].includes(state)) {
      throw new Error(`${label} transaction failed (${state}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`${label} transaction did not complete in time.`);
};

const getUserHubWallet = async (uid: string) => {
  const walletsByChain = await getUserCircleWalletsByChain(uid);
  const wallet = getWalletByChain(walletsByChain, HUB_DESTINATION_CHAIN);

  if (!wallet?.walletId || !wallet?.address) {
    throw new Error("Missing user wallet for hub chain.");
  }

  return { walletId: wallet.walletId, address: wallet.address };
};

const buildAmountsArray = (poolSize: number, usdcIndex: number, amount: string) => {
  const amounts = Array.from({ length: poolSize }, () => "0");
  amounts[usdcIndex] = amount;
  return amounts;
};

const estimateLpTokens = async (params: {
  poolAddress: string;
  poolSize: number;
  amounts: string[];
  provider: ethers.JsonRpcProvider;
}) => {
  const pool = new ethers.Contract(params.poolAddress, curvePoolIface, params.provider);
  const cache = getCurveMethodCacheEntry(params.poolAddress, params.poolSize);
  const candidates = prioritizeCachedSignature(
    cache.calcTokenAmountSig,
    getCalcTokenAmountCandidates(params.poolSize),
  );
  const attempted: string[] = [];

  for (const signature of candidates) {
    try {
      const args = buildCalcTokenAmountArgs({
        signature,
        poolSize: params.poolSize,
        amounts: params.amounts,
      });
      const result = await (pool as any)[signature](...args);
      if (cache.calcTokenAmountSig !== signature) {
        logger.info(
          {
            poolAddress: params.poolAddress,
            poolSize: params.poolSize,
            signature,
            selector: getSelectorForSignature(signature),
          },
          "[liquidity] selected calc_token_amount signature",
        );
      }
      cache.calcTokenAmountSig = signature;
      return result as bigint;
    } catch (error) {
      attempted.push(
        `${signature} [${getSelectorForSignature(signature)}] -> ${getErrorMessage(error)}`,
      );
    }
  }

  throw new Error(
    `Failed to quote Curve LP tokens for pool ${params.poolAddress}. Attempted: ${attempted.join(" | ")}`,
  );
};

const resolveAddLiquidityCallData = async (params: {
  poolAddress: string;
  poolSize: number;
  amounts: string[];
  minMintAmount: string;
  walletAddress: string;
  provider: ethers.JsonRpcProvider;
}) => {
  const {
    poolAddress,
    poolSize,
    amounts,
    minMintAmount,
    walletAddress,
    provider,
  } = params;

  const cache = getCurveMethodCacheEntry(poolAddress, poolSize);
  const signatures = prioritizeCachedSignature(
    cache.addLiquiditySig,
    getAddLiquidityCandidates(poolSize),
  );
  const attempted: string[] = [];

  for (const signature of signatures) {
    try {
      const args = buildAddLiquidityArgs({
        signature,
        poolSize,
        amounts,
        minMintAmount,
        walletAddress,
      });
      const callData = curvePoolIface.encodeFunctionData(signature, args);
      await provider.call({
        from: walletAddress,
        to: poolAddress,
        data: callData,
      });
      if (cache.addLiquiditySig !== signature) {
        logger.info(
          {
            poolAddress,
            poolSize,
            signature,
            selector: getSelectorForSignature(signature),
          },
          "[liquidity] selected add_liquidity signature",
        );
      }
      cache.addLiquiditySig = signature;
      return { callData, signature };
    } catch (error) {
      const args = buildAddLiquidityArgs({
        signature,
        poolSize,
        amounts,
        minMintAmount,
        walletAddress,
      });
      const callData = curvePoolIface.encodeFunctionData(signature, args);
      if (isLikelyStateDependentRevert(error)) {
        logger.info(
          {
            poolAddress,
            poolSize,
            signature,
            selector: getSelectorForSignature(signature),
            reason: getErrorMessage(error),
          },
          "[liquidity] selected add_liquidity signature from state-dependent revert",
        );
        cache.addLiquiditySig = signature;
        return { callData, signature };
      }
      attempted.push(
        `${signature} [${getSelectorForSignature(signature)}] -> ${getErrorMessage(error)}`,
      );
    }
  }

  throw new Error(
    `Failed to resolve add_liquidity signature for pool ${poolAddress}. Attempted: ${attempted.join(" | ")}`,
  );
};

const resolveRemoveOneCoinCallData = async (params: {
  poolAddress: string;
  poolSize: number;
  burnAmount: string;
  usdcIndex: number;
  minReceived: string;
  walletAddress: string;
  provider: ethers.JsonRpcProvider;
}) => {
  const {
    poolAddress,
    poolSize,
    burnAmount,
    usdcIndex,
    minReceived,
    walletAddress,
    provider,
  } = params;

  const cache = getCurveMethodCacheEntry(poolAddress, poolSize);
  const signatures = prioritizeCachedSignature(
    cache.removeOneCoinSig,
    getRemoveOneCoinCandidates(),
  );
  const attempted: string[] = [];

  for (const signature of signatures) {
    try {
      const args = buildRemoveOneCoinArgs({
        signature,
        burnAmount,
        usdcIndex,
        minReceived,
        walletAddress,
      });
      const callData = curvePoolIface.encodeFunctionData(signature, args);
      await provider.call({
        from: walletAddress,
        to: poolAddress,
        data: callData,
      });
      if (cache.removeOneCoinSig !== signature) {
        logger.info(
          {
            poolAddress,
            poolSize,
            signature,
            selector: getSelectorForSignature(signature),
          },
          "[liquidity] selected remove_liquidity_one_coin signature",
        );
      }
      cache.removeOneCoinSig = signature;
      return { callData, signature };
    } catch (error) {
      const args = buildRemoveOneCoinArgs({
        signature,
        burnAmount,
        usdcIndex,
        minReceived,
        walletAddress,
      });
      const callData = curvePoolIface.encodeFunctionData(signature, args);
      if (isLikelyStateDependentRevert(error)) {
        logger.info(
          {
            poolAddress,
            poolSize,
            signature,
            selector: getSelectorForSignature(signature),
            reason: getErrorMessage(error),
          },
          "[liquidity] selected remove_liquidity_one_coin signature from state-dependent revert",
        );
        cache.removeOneCoinSig = signature;
        return { callData, signature };
      }
      attempted.push(
        `${signature} [${getSelectorForSignature(signature)}] -> ${getErrorMessage(error)}`,
      );
    }
  }

  throw new Error(
    `Failed to resolve remove_liquidity_one_coin signature for pool ${poolAddress}. Attempted: ${attempted.join(" | ")}`,
  );
};

const findBurnAmountForUsdc = async (params: {
  poolAddress: string;
  provider: ethers.JsonRpcProvider;
  usdcIndex: number;
  targetOut: bigint;
  maxBurn: bigint;
}) => {
  const { poolAddress, provider, usdcIndex, targetOut, maxBurn } = params;
  const pool = new ethers.Contract(poolAddress, curvePoolIface, provider);

  const maxOut = await (pool as any).calc_withdraw_one_coin(maxBurn, usdcIndex);
  if (maxOut < targetOut) {
    throw new Error("Insufficient LP balance to cover requested USDC amount.");
  }

  let low = 0n;
  let high = maxBurn;
  let best = maxBurn;

  for (let i = 0; i < 32 && low <= high; i += 1) {
    const mid = (low + high) / 2n;
    const out = await (pool as any).calc_withdraw_one_coin(mid, usdcIndex);
    if (out >= targetOut) {
      best = mid;
      if (mid === 0n) break;
      high = mid - 1n;
    } else {
      low = mid + 1n;
    }
  }

  return best;
};

export const quoteUsdcCurveDeposit = async (params: { amount: string }) => {
  const amountBaseUnits = parseUsdcAmountToBaseUnits(params.amount);
  const amount = fromBaseUnits(amountBaseUnits, USDC_DECIMALS);
  await ensureCurvePoolVerified();

  const { poolAddress, lpTokenAddress, usdcIndex, poolSize, slippageBps } =
    getCurveConfig();
  const provider = getProvider();
  const amountBaseUnitsString = amountBaseUnits.toString();
  const amounts = buildAmountsArray(poolSize, usdcIndex, amountBaseUnitsString);

  const estimatedLp = await estimateLpTokens({ poolAddress, poolSize, amounts, provider });
  const minMintAmount = applySlippage(estimatedLp, slippageBps);

  return {
    amount,
    poolAddress,
    lpTokenAddress,
    usdcIndex,
    poolSize,
    estimatedLpTokens: estimatedLp.toString(),
    minMintAmount: minMintAmount.toString(),
    slippageBps,
  };
};

export const depositUsdcToCurve = async (params: { uid: string; amount: string }) => {
  const { uid } = params;
  const amountBaseUnits = parseUsdcAmountToBaseUnits(params.amount);
  const amount = fromBaseUnits(amountBaseUnits, USDC_DECIMALS);
  await ensureCurvePoolVerified();

  const { poolAddress, lpTokenAddress, usdcIndex, poolSize, slippageBps } =
    getCurveConfig();
  const provider = getProvider();

  const { walletId, address: walletAddress } = await getUserHubWallet(uid);
  const usdcToken = new ethers.Contract(
    USDC_TOKEN_ADDRESS_BY_CHAIN[HUB_DESTINATION_CHAIN],
    erc20ReadAbi,
    provider,
  ) as unknown as {
    balanceOf: (owner: string) => Promise<bigint>;
  };

  const usdcBalance = await usdcToken.balanceOf(walletAddress);
  if (usdcBalance < amountBaseUnits) {
    throw new Error(
      `Insufficient USDC balance on ${HUB_DESTINATION_CHAIN}. Required ${amount}, available ${fromBaseUnits(
        usdcBalance,
        USDC_DECIMALS,
      )}.`,
    );
  }

  const amountBaseUnitsString = amountBaseUnits.toString();
  const amounts = buildAmountsArray(poolSize, usdcIndex, amountBaseUnitsString);

  logger.info(
    {
      uid,
      amount,
      hubChain: HUB_DESTINATION_CHAIN,
      poolAddress,
      usdcIndex,
    },
    "[liquidity] curve deposit",
  );

  const estimatedLp = await estimateLpTokens({ poolAddress, poolSize, amounts, provider });
  const minMintAmount = applySlippage(estimatedLp, slippageBps);

  const approveData = erc20Iface.encodeFunctionData("approve", [
    poolAddress,
    amountBaseUnitsString,
  ]);

  const approvalCircleTxId = await submitCircleContractExecution({
    walletId,
    contractAddress: USDC_TOKEN_ADDRESS_BY_CHAIN[HUB_DESTINATION_CHAIN],
    callData: approveData,
    refId: `liquidity-approve:${uid}:${Date.now()}`,
  });

  await waitForCircleTxCompletion({
    txId: approvalCircleTxId,
    label: "liquidity-approve",
  });

  const { callData: addLiquidityCallData, signature: addLiquiditySignature } =
    await resolveAddLiquidityCallData({
      poolAddress,
      poolSize,
      amounts,
      minMintAmount: minMintAmount.toString(),
      walletAddress,
      provider,
    });

  const depositCircleTxId = await submitCircleContractExecution({
    walletId,
    contractAddress: poolAddress,
    callData: addLiquidityCallData,
    refId: `liquidity-deposit:${uid}:${Date.now()}`,
  });

  const positionRef = getCurvePositionRef(uid);
  const positionSnap = await positionRef.get();
  await positionRef.set(
    {
      amount,
      amountBaseUnits: amountBaseUnitsString,
      poolAddress,
      lpTokenAddress,
      usdcIndex,
      poolSize,
      status: "PENDING_ONCHAIN",
      lastDepositTxId: depositCircleTxId,
      lastDepositAmount: amount,
      lastDepositAmountBaseUnits: amountBaseUnitsString,
      estimatedLpTokens: estimatedLp.toString(),
      minMintAmount: minMintAmount.toString(),
      hubChain: HUB_DESTINATION_CHAIN,
      updatedAt: serverTimestamp(),
      ...(positionSnap.exists ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  await upsertTransaction(uid, `earn:curve:deposit:${depositCircleTxId}`, {
    kind: "EARN",
    status: "PENDING",
    amount,
    symbol: "USDC",
    blockchain: HUB_DESTINATION_CHAIN,
    relatedTxId: depositCircleTxId,
    metadata: {
      action: "ADD_LIQUIDITY",
      poolAddress,
      lpTokenAddress,
      usdcIndex,
      addLiquiditySignature,
    },
  });

  return { approvalCircleTxId, depositCircleTxId };
};

export const refreshCurvePositionForUser = async (uid: string) => {
  await ensureCurvePoolVerified();

  const { poolAddress, lpTokenAddress, usdcIndex, poolSize } = getCurveConfig();
  const provider = getProvider();
  const { address } = await getUserHubWallet(uid);

  const lpToken = new ethers.Contract(lpTokenAddress, erc20ReadAbi, provider) as unknown as {
    balanceOf: (owner: string) => Promise<bigint>;
    decimals: () => Promise<number>;
  };

  const [lpBalance, lpDecimals] = await Promise.all([
    lpToken.balanceOf(address),
    lpToken.decimals(),
  ]);

  let usdcValueBaseUnits = 0n;
  if (lpBalance > 0n) {
    const pool = new ethers.Contract(poolAddress, curvePoolIface, provider) as unknown as {
      calc_withdraw_one_coin: (burnAmount: bigint, i: number) => Promise<bigint>;
    };
    usdcValueBaseUnits = await pool.calc_withdraw_one_coin(lpBalance, usdcIndex);
  }

  const usdcValue = fromBaseUnits(usdcValueBaseUnits, USDC_DECIMALS);
  const status = lpBalance > 0n ? "ACTIVE" : "EMPTY";

  const positionRef = getCurvePositionRef(uid);
  await positionRef.set(
    {
      poolAddress,
      lpTokenAddress,
      usdcIndex,
      poolSize,
      lpBalance: lpBalance.toString(),
      lpDecimals,
      usdcValue,
      usdcValueBaseUnits: usdcValueBaseUnits.toString(),
      status,
      hubChain: HUB_DESTINATION_CHAIN,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const snap = await positionRef.get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
};

export const getCurvePositionForUser = async (uid: string) => {
  try {
    return await refreshCurvePositionForUser(uid);
  } catch (error) {
    logger.warn(
      { uid, error: (error as Error)?.message },
      "[liquidity] failed to refresh curve position",
    );

    const snap = await getCurvePositionRef(uid).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
  }
};

export const withdrawUsdcFromCurve = async (params: { uid: string; amount: string }) => {
  const { uid } = params;
  const amountBaseUnits = parseUsdcAmountToBaseUnits(params.amount);
  const amount = fromBaseUnits(amountBaseUnits, USDC_DECIMALS);
  await ensureCurvePoolVerified();

  const { poolAddress, lpTokenAddress, usdcIndex, poolSize, slippageBps } =
    getCurveConfig();
  const provider = getProvider();
  const { walletId, address } = await getUserHubWallet(uid);

  const lpToken = new ethers.Contract(lpTokenAddress, erc20ReadAbi, provider) as unknown as {
    balanceOf: (owner: string) => Promise<bigint>;
    allowance: (owner: string, spender: string) => Promise<bigint>;
    decimals: () => Promise<number>;
  };

  const [lpBalance, lpAllowance, lpDecimals] = await Promise.all([
    lpToken.balanceOf(address),
    lpToken.allowance(address, poolAddress),
    lpToken.decimals(),
  ]);

  if (lpBalance <= 0n) {
    throw new Error("No Curve LP balance available to withdraw.");
  }

  const burnAmount = await findBurnAmountForUsdc({
    poolAddress,
    provider,
    usdcIndex,
    targetOut: amountBaseUnits,
    maxBurn: lpBalance,
  });
  if (burnAmount === 0n) {
    throw new Error("Withdraw amount is too small for the current pool state.");
  }

  const minReceived = applySlippage(amountBaseUnits, slippageBps);

  let approvalCircleTxId: string | null = null;
  if (lpAllowance < burnAmount) {
    const approveLpData = erc20Iface.encodeFunctionData("approve", [
      poolAddress,
      burnAmount.toString(),
    ]);

    approvalCircleTxId = await submitCircleContractExecution({
      walletId,
      contractAddress: lpTokenAddress,
      callData: approveLpData,
      refId: `liquidity-approve-lp:${uid}:${Date.now()}`,
    });

    await waitForCircleTxCompletion({
      txId: approvalCircleTxId,
      label: "liquidity-approve-lp",
    });
  }

  const { callData: withdrawCallData, signature: removeOneCoinSignature } =
    await resolveRemoveOneCoinCallData({
      poolAddress,
      poolSize,
      burnAmount: burnAmount.toString(),
      usdcIndex,
      minReceived: minReceived.toString(),
      walletAddress: address,
      provider,
    });

  const withdrawCircleTxId = await submitCircleContractExecution({
    walletId,
    contractAddress: poolAddress,
    callData: withdrawCallData,
    refId: `liquidity-withdraw:${uid}:${Date.now()}`,
  });

  const positionRef = getCurvePositionRef(uid);
  const positionSnap = await positionRef.get();
  await positionRef.set(
    {
      poolAddress,
      lpTokenAddress,
      usdcIndex,
      poolSize,
      status: "WITHDRAW_PENDING",
      lastWithdrawTxId: withdrawCircleTxId,
      lastWithdrawAmount: amount,
      lastWithdrawAmountBaseUnits: amountBaseUnits.toString(),
      lastWithdrawBurnAmount: burnAmount.toString(),
      lpBalance: lpBalance.toString(),
      lpDecimals,
      hubChain: HUB_DESTINATION_CHAIN,
      updatedAt: serverTimestamp(),
      ...(positionSnap.exists ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  await upsertTransaction(uid, `earn:curve:withdraw:${withdrawCircleTxId}`, {
    kind: "EARN",
    status: "PENDING",
    amount,
    symbol: "USDC",
    blockchain: HUB_DESTINATION_CHAIN,
    relatedTxId: withdrawCircleTxId,
    metadata: {
      action: "WITHDRAW_LIQUIDITY",
      poolAddress,
      lpTokenAddress,
      burnAmount: burnAmount.toString(),
      usdcIndex,
      removeOneCoinSignature,
    },
  });

  return { withdrawCircleTxId, approvalCircleTxId };
};
