import { ethers } from "ethers";

import { config } from "../../config.js";
import { HUB_DESTINATION_CHAIN } from "../../lib/chains.js";
import { USDC_TOKEN_ADDRESS_BY_CHAIN } from "../../lib/usdcAddresses.js";

const DEFAULT_SLIPPAGE_BPS = 50;

export type CurveConfig = {
  poolAddress: string;
  lpTokenAddress: string;
  usdcIndex: number;
  poolSize: number;
  expectedPairTokenAddress: string;
  slippageBps: number;
};

export const erc20ReadAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export const curvePoolIface = new ethers.Interface([
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

export const getCurveConfig = (): CurveConfig => {
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

export const getProvider = () => {
  const url = config.HUB_CHAIN_RPC_URL;
  if (!url) throw new Error("Missing HUB_CHAIN_RPC_URL");
  return new ethers.JsonRpcProvider(url);
};

let curveVerificationPromise: Promise<void> | null = null;
let curveVerified = false;

export const ensureCurvePoolVerified = async () => {
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
