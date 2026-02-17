import { curvePoolIface } from "./curveConfig.js";

export const getErrorMessage = (error: unknown) =>
  (error as any)?.shortMessage ??
  (error as any)?.reason ??
  (error as Error)?.message ??
  "unknown error";

export const getSelectorForSignature = (signature: string) => {
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

export const isLikelyStateDependentRevert = (error: unknown) => {
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

export const prioritizeCachedSignature = (
  cached: string | undefined,
  candidates: string[],
) => {
  if (!cached || !candidates.includes(cached)) return candidates;
  return [cached, ...candidates.filter((candidate) => candidate !== cached)];
};

export const getCalcTokenAmountCandidates = (poolSize: number) =>
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

export const getAddLiquidityCandidates = (poolSize: number) =>
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

export const getRemoveOneCoinCandidates = () => [
  "remove_liquidity_one_coin(uint256,int128,uint256)",
  "remove_liquidity_one_coin(uint256,int128,uint256,address)",
  "remove_liquidity_one_coin(uint256,uint256,uint256)",
  "remove_liquidity_one_coin(uint256,uint256,uint256,address)",
];

export const buildCalcTokenAmountArgs = (params: {
  signature: string;
  poolSize: number;
  amounts: string[];
}) => {
  const { signature, poolSize, amounts } = params;
  const fixed =
    poolSize === 2
      ? ([amounts[0]!, amounts[1]!] as [string, string])
      : ([amounts[0]!, amounts[1]!, amounts[2]!] as [string, string, string]);

  if (signature === "calc_token_amount(uint256[2],bool)") return [fixed, true];
  if (signature === "calc_token_amount(uint256[2])") return [fixed];
  if (signature === "calc_token_amount(uint256[3],bool)") return [fixed, true];
  if (signature === "calc_token_amount(uint256[3])") return [fixed];
  if (signature === "calc_token_amount(uint256[],bool)") return [amounts, true];
  if (signature === "calc_token_amount(uint256[])") return [amounts];

  throw new Error(`Unsupported calc_token_amount signature: ${signature}`);
};

export const buildAddLiquidityArgs = (params: {
  signature: string;
  poolSize: number;
  amounts: string[];
  minMintAmount: string;
  walletAddress: string;
}) => {
  const { signature, poolSize, amounts, minMintAmount, walletAddress } = params;
  const fixed =
    poolSize === 2
      ? ([amounts[0]!, amounts[1]!] as [string, string])
      : ([amounts[0]!, amounts[1]!, amounts[2]!] as [string, string, string]);

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

export const buildRemoveOneCoinArgs = (params: {
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
