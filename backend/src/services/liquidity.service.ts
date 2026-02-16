import admin from "firebase-admin";
import crypto from "crypto";
import { ethers } from "ethers";

import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import {
  HUB_DESTINATION_CHAIN,
  USDC_DECIMALS,
  USDC_TOKEN_ADDRESS_BY_CHAIN,
} from "../lib/usdcAddresses.js";
import { getWalletByChain } from "../lib/wallets.js";
import { getCircleClient } from "../lib/circleClient.js";
import { upsertTransaction } from "../lib/transactions.js";
import { config } from "../config.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const DEFAULT_SLIPPAGE_BPS = 50;
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

type CurveConfig = {
  poolAddress: string;
  lpTokenAddress: string;
  usdcIndex: number;
  poolSize: number;
  expectedPairTokenAddress: string;
  slippageBps: number;
};

const getCurveConfig = (): CurveConfig => {
  const poolAddress = config.CURVE_POOL_ADDRESS ?? "";
  const lpTokenAddress = config.CURVE_LP_TOKEN_ADDRESS ?? "";
  const usdcIndexRaw = config.CURVE_USDC_INDEX ?? "";
  const poolSizeRaw = config.CURVE_POOL_SIZE ?? "";
  const expectedPairTokenAddressRaw = config.CURVE_EXPECTED_PAIR_TOKEN_ADDRESS ?? "";
  const slippageRaw = config.CURVE_SLIPPAGE_BPS;

  if (
    !poolAddress ||
    !lpTokenAddress ||
    !usdcIndexRaw ||
    !poolSizeRaw ||
    !expectedPairTokenAddressRaw
  ) {
    throw new Error(
      "Curve config missing. Set CURVE_POOL_ADDRESS, CURVE_LP_TOKEN_ADDRESS, CURVE_USDC_INDEX, CURVE_POOL_SIZE, CURVE_EXPECTED_PAIR_TOKEN_ADDRESS.",
    );
  }

  const usdcIndex = Number(usdcIndexRaw);
  const poolSize = Number(poolSizeRaw);
  const expectedPairTokenAddress = expectedPairTokenAddressRaw.toLowerCase();
  const slippageBps =
    slippageRaw == null || slippageRaw === ""
      ? DEFAULT_SLIPPAGE_BPS
      : Number(slippageRaw);

  if (!Number.isInteger(usdcIndex) || usdcIndex < 0) {
    throw new Error("CURVE_USDC_INDEX must be a non-negative integer.");
  }
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    throw new Error("CURVE_POOL_SIZE must be a positive integer.");
  }
  if (!ethers.isAddress(expectedPairTokenAddress)) {
    throw new Error("CURVE_EXPECTED_PAIR_TOKEN_ADDRESS must be a valid EVM address.");
  }
  if (
    expectedPairTokenAddress ===
    USDC_TOKEN_ADDRESS_BY_CHAIN[HUB_DESTINATION_CHAIN].toLowerCase()
  ) {
    throw new Error("CURVE_EXPECTED_PAIR_TOKEN_ADDRESS must not be the USDC address.");
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 500) {
    throw new Error("CURVE_SLIPPAGE_BPS must be between 0 and 500.");
  }

  if (poolSize !== 2 && poolSize !== 3) {
    throw new Error("Only Curve pools with size 2 or 3 are supported right now.");
  }

  return {
    poolAddress,
    lpTokenAddress,
    usdcIndex,
    poolSize,
    expectedPairTokenAddress,
    slippageBps,
  };
};

const getProvider = () => {
  const url = config.HUB_CHAIN_RPC_URL;
  if (!url) throw new Error("Missing HUB_CHAIN_RPC_URL");
  return new ethers.JsonRpcProvider(url);
};

const erc20Iface = new ethers.Interface([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const erc20ReadAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const curvePoolIface = new ethers.Interface([
  "function add_liquidity(uint256[2] amounts, uint256 min_mint_amount)",
  "function add_liquidity(uint256[3] amounts, uint256 min_mint_amount)",
  "function add_liquidity(uint256[] amounts, uint256 min_mint_amount)",
  "function add_liquidity(uint256[2] amounts, uint256 min_mint_amount, address receiver)",
  "function add_liquidity(uint256[3] amounts, uint256 min_mint_amount, address receiver)",
  "function add_liquidity(uint256[] amounts, uint256 min_mint_amount, address receiver)",
  "function remove_liquidity_one_coin(uint256 burn_amount, int128 i, uint256 min_received)",
  "function remove_liquidity_one_coin(uint256 burn_amount, int128 i, uint256 min_received, address receiver)",
  "function remove_liquidity_one_coin(uint256 burn_amount, uint256 i, uint256 min_received)",
  "function remove_liquidity_one_coin(uint256 burn_amount, uint256 i, uint256 min_received, address receiver)",
  "function calc_withdraw_one_coin(uint256 burn_amount, int128 i) view returns (uint256)",
  "function calc_token_amount(uint256[2] amounts, bool is_deposit) view returns (uint256)",
  "function calc_token_amount(uint256[2] amounts) view returns (uint256)",
  "function calc_token_amount(uint256[3] amounts, bool is_deposit) view returns (uint256)",
  "function calc_token_amount(uint256[3] amounts) view returns (uint256)",
  "function calc_token_amount(uint256[] amounts, bool is_deposit) view returns (uint256)",
  "function calc_token_amount(uint256[] amounts) view returns (uint256)",
  "function coins(uint256 index) view returns (address)",
]);

let curveVerificationPromise: Promise<void> | null = null;
let curveVerified = false;

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

const getErrorMessage = (error: unknown) =>
  (error as any)?.shortMessage ??
  (error as any)?.reason ??
  (error as Error)?.message ??
  "unknown error";

const getSelectorForSignature = (signature: string) => {
  try {
    return curvePoolIface.getFunction(signature)?.selector ?? "unknown";
  } catch {
    return "unknown";
  }
};

const isLikelyNoDataSignatureRevert = (error: unknown) => {
  const message = `${getErrorMessage(error)} ${(error as any)?.message ?? ""}`.toLowerCase();
  return (
    message.includes("no data present") ||
    message.includes("require(false)") ||
    message.includes("function selector was not recognized")
  );
};

const isLikelyStateDependentRevert = (error: unknown) => {
  const message = `${getErrorMessage(error)} ${(error as any)?.message ?? ""}`.toLowerCase();
  if (!message || isLikelyNoDataSignatureRevert(error)) return false;

  return (
    message.includes("transfer amount exceeds balance") ||
    message.includes("erc20insufficientbalance") ||
    message.includes("insufficient balance") ||
    message.includes("transfer amount exceeds allowance") ||
    message.includes("erc20insufficientallowance") ||
    message.includes("insufficient allowance") ||
    message.includes("min_mint_amount") ||
    message.includes("min_received") ||
    message.includes("slippage") ||
    message.includes("not enough coins removed") ||
    message.includes("burn amount exceeds") ||
    message.includes("insufficient lp")
  );
};

const ensureCurvePoolVerified = async () => {
  if (curveVerified) return;
  if (!curveVerificationPromise) {
    curveVerificationPromise = (async () => {
      const { poolAddress, lpTokenAddress, usdcIndex, poolSize, expectedPairTokenAddress } =
        getCurveConfig();
      const provider = getProvider();

      if (usdcIndex >= poolSize) {
        throw new Error(
          `CURVE_USDC_INDEX ${usdcIndex} is out of range for pool size ${poolSize}.`,
        );
      }

      const pool = new ethers.Contract(poolAddress, curvePoolIface, provider);
      const coinAddresses = await Promise.all(
        Array.from({ length: poolSize }, (_v, idx) =>
          (pool as any).coins(idx).then((address: string) => address),
        ),
      );

      const expectedUsdc =
        USDC_TOKEN_ADDRESS_BY_CHAIN[HUB_DESTINATION_CHAIN].toLowerCase();
      const actualUsdc = coinAddresses[usdcIndex]?.toLowerCase();

      if (!actualUsdc) {
        throw new Error("Curve pool verification failed: missing coin address.");
      }

      if (actualUsdc !== expectedUsdc) {
        throw new Error(
          `Curve pool USDC index mismatch. Expected ${expectedUsdc} at index ${usdcIndex}, got ${actualUsdc}.`,
        );
      }

      const nonUsdcCoinAddresses = coinAddresses
        .map((address) => address.toLowerCase())
        .filter((_addr, index) => index !== usdcIndex);
      if (poolSize === 2) {
        const actualPair = nonUsdcCoinAddresses[0];
        if (!actualPair || actualPair !== expectedPairTokenAddress) {
          throw new Error(
            `Curve pool pair mismatch. Expected pair token ${expectedPairTokenAddress}, got ${actualPair ?? "missing"}.`,
          );
        }
      } else if (!nonUsdcCoinAddresses.includes(expectedPairTokenAddress)) {
        throw new Error(
          `Curve pool pair mismatch. Expected to find pair token ${expectedPairTokenAddress} among ${nonUsdcCoinAddresses.join(", ")}.`,
        );
      }

      const symbolChecks = await Promise.all(
        coinAddresses.map(async (addr) => {
          const token = new ethers.Contract(addr, erc20ReadAbi, provider);
          const symbol = await (token as any).symbol();
          return { addr, symbol };
        }),
      );

      const usdcSymbol = symbolChecks[usdcIndex]?.symbol ?? "";
      if (!usdcSymbol.toUpperCase().includes("USDC")) {
        throw new Error(
          `Curve pool verification failed: coin at index ${usdcIndex} is not USDC (symbol ${usdcSymbol}).`,
        );
      }

      const lpToken = new ethers.Contract(lpTokenAddress, erc20ReadAbi, provider);
      try {
        await Promise.all([(lpToken as any).symbol(), (lpToken as any).decimals()]);
      } catch (error) {
        throw new Error(
          `Curve LP token verification failed for ${lpTokenAddress}: ${
            (error as Error)?.message ?? "unknown error"
          }`,
        );
      }
    })()
      .then(() => {
        curveVerified = true;
      })
      .catch((error) => {
        curveVerificationPromise = null;
        throw error;
      });
  }

  await curveVerificationPromise;
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
    const txResp = await (circle as any).getTransaction({ id: txId });
    const tx = txResp?.data?.transaction as any;
    const state = (tx?.state as string | undefined) ?? null;
    const txHash = (tx?.txHash as string | undefined) ?? null;

    console.info("[liquidity] circle tx status", {
      label,
      txId,
      attempt,
      state,
      txHash,
    });

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
  const userSnap = await firestoreAdmin.collection("users").doc(uid).get();
  const wallet = getWalletByChain(
    userSnap.data()?.circle?.walletsByChain as Record<string, any> | undefined,
    HUB_DESTINATION_CHAIN,
  );

  if (!wallet?.walletId || !wallet?.address) {
    throw new Error("Missing user wallet for hub chain.");
  }

  return { walletId: wallet.walletId, address: wallet.address };
};

const getCurvePositionRef = (uid: string) =>
  firestoreAdmin.collection("users").doc(uid).collection("positions").doc("curve");

const buildAmountsArray = (poolSize: number, usdcIndex: number, amount: string) => {
  const amounts = Array.from({ length: poolSize }, () => "0");
  amounts[usdcIndex] = amount;
  return amounts;
};

const toFixedAmounts = (poolSize: number, amounts: string[]) => {
  if (poolSize === 2) return [amounts[0]!, amounts[1]!] as [string, string];
  return [amounts[0]!, amounts[1]!, amounts[2]!] as [string, string, string];
};

const prioritizeCachedSignature = (cached: string | undefined, candidates: string[]) => {
  if (!cached || !candidates.includes(cached)) return candidates;
  return [cached, ...candidates.filter((candidate) => candidate !== cached)];
};

const getCalcTokenAmountCandidates = (poolSize: number) =>
  poolSize === 2
    ? [
        "calc_token_amount(uint256[2],bool)",
        "calc_token_amount(uint256[2])",
        "calc_token_amount(uint256[],bool)",
        "calc_token_amount(uint256[])",
      ]
    : [
        "calc_token_amount(uint256[3],bool)",
        "calc_token_amount(uint256[3])",
        "calc_token_amount(uint256[],bool)",
        "calc_token_amount(uint256[])",
      ];

const getAddLiquidityCandidates = (poolSize: number) =>
  poolSize === 2
    ? [
        "add_liquidity(uint256[2],uint256)",
        "add_liquidity(uint256[2],uint256,address)",
        "add_liquidity(uint256[],uint256)",
        "add_liquidity(uint256[],uint256,address)",
      ]
    : [
        "add_liquidity(uint256[3],uint256)",
        "add_liquidity(uint256[3],uint256,address)",
        "add_liquidity(uint256[],uint256)",
        "add_liquidity(uint256[],uint256,address)",
      ];

const getRemoveOneCoinCandidates = () => [
  "remove_liquidity_one_coin(uint256,int128,uint256)",
  "remove_liquidity_one_coin(uint256,int128,uint256,address)",
  "remove_liquidity_one_coin(uint256,uint256,uint256)",
  "remove_liquidity_one_coin(uint256,uint256,uint256,address)",
];

const buildCalcTokenAmountArgs = (params: {
  signature: string;
  poolSize: number;
  amounts: string[];
}) => {
  const { signature, poolSize, amounts } = params;
  const fixed = toFixedAmounts(poolSize, amounts);

  if (signature === "calc_token_amount(uint256[2],bool)") return [fixed, true];
  if (signature === "calc_token_amount(uint256[2])") return [fixed];
  if (signature === "calc_token_amount(uint256[3],bool)") return [fixed, true];
  if (signature === "calc_token_amount(uint256[3])") return [fixed];
  if (signature === "calc_token_amount(uint256[],bool)") return [amounts, true];
  if (signature === "calc_token_amount(uint256[])") return [amounts];

  throw new Error(`Unsupported calc_token_amount signature: ${signature}`);
};

const buildAddLiquidityArgs = (params: {
  signature: string;
  poolSize: number;
  amounts: string[];
  minMintAmount: string;
  walletAddress: string;
}) => {
  const { signature, poolSize, amounts, minMintAmount, walletAddress } = params;
  const fixed = toFixedAmounts(poolSize, amounts);

  if (signature === "add_liquidity(uint256[2],uint256)") return [fixed, minMintAmount];
  if (signature === "add_liquidity(uint256[3],uint256)") return [fixed, minMintAmount];
  if (signature === "add_liquidity(uint256[],uint256)") return [amounts, minMintAmount];
  if (signature === "add_liquidity(uint256[2],uint256,address)")
    return [fixed, minMintAmount, walletAddress];
  if (signature === "add_liquidity(uint256[3],uint256,address)")
    return [fixed, minMintAmount, walletAddress];
  if (signature === "add_liquidity(uint256[],uint256,address)")
    return [amounts, minMintAmount, walletAddress];

  throw new Error(`Unsupported add_liquidity signature: ${signature}`);
};

const buildRemoveOneCoinArgs = (params: {
  signature: string;
  burnAmount: string;
  usdcIndex: number;
  minReceived: string;
  walletAddress: string;
}) => {
  const { signature, burnAmount, usdcIndex, minReceived, walletAddress } = params;

  if (signature === "remove_liquidity_one_coin(uint256,int128,uint256)") {
    return [burnAmount, usdcIndex, minReceived];
  }
  if (signature === "remove_liquidity_one_coin(uint256,int128,uint256,address)") {
    return [burnAmount, usdcIndex, minReceived, walletAddress];
  }
  if (signature === "remove_liquidity_one_coin(uint256,uint256,uint256)") {
    return [burnAmount, BigInt(usdcIndex), minReceived];
  }
  if (signature === "remove_liquidity_one_coin(uint256,uint256,uint256,address)") {
    return [burnAmount, BigInt(usdcIndex), minReceived, walletAddress];
  }

  throw new Error(`Unsupported remove_liquidity_one_coin signature: ${signature}`);
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
        console.info("[liquidity] selected calc_token_amount signature", {
          poolAddress: params.poolAddress,
          poolSize: params.poolSize,
          signature,
          selector: getSelectorForSignature(signature),
        });
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
        console.info("[liquidity] selected add_liquidity signature", {
          poolAddress,
          poolSize,
          signature,
          selector: getSelectorForSignature(signature),
        });
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
        console.info("[liquidity] selected add_liquidity signature from state-dependent revert", {
          poolAddress,
          poolSize,
          signature,
          selector: getSelectorForSignature(signature),
          reason: getErrorMessage(error),
        });
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
        console.info("[liquidity] selected remove_liquidity_one_coin signature", {
          poolAddress,
          poolSize,
          signature,
          selector: getSelectorForSignature(signature),
        });
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
        console.info(
          "[liquidity] selected remove_liquidity_one_coin signature from state-dependent revert",
          {
            poolAddress,
            poolSize,
            signature,
            selector: getSelectorForSignature(signature),
            reason: getErrorMessage(error),
          },
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

  console.log("[liquidity] curve deposit", {
    uid,
    amount,
    hubChain: HUB_DESTINATION_CHAIN,
    poolAddress,
    usdcIndex,
  });

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
    console.warn("[liquidity] failed to refresh curve position", {
      uid,
      error: (error as Error)?.message,
    });

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
