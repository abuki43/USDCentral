import { BridgeKit } from "@circle-fin/bridge-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

import { firestoreAdmin } from "../lib/firebaseAdmin.js";
import {
  BASE_DESTINATION_CHAIN,
  type SupportedChain,
} from "../lib/usdcAddresses.js";

const BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN = {
  "ETH-SEPOLIA": "Ethereum_Sepolia",
  "MATIC-AMOY": "Polygon_Amoy_Testnet",
  "ARB-SEPOLIA": "Arbitrum_Sepolia",
  "OP-SEPOLIA": "Optimism_Sepolia",
  "BASE-SEPOLIA": "Base_Sepolia",
  "SOL-DEVNET": "Solana_Devnet",
} as const satisfies Record<SupportedChain, string>;

type BridgeKitChain = (typeof BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN)[SupportedChain];

const getBridgeKitAdapter = () => {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error(
      "Missing Circle config. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET.",
    );
  }

  return createCircleWalletsAdapter({
    apiKey,
    entitySecret,
  });
};

const getBridgeKit = () => new BridgeKit();

export const bridgeUsdcToBaseForUser = async (params: {
  uid: string;
  sourceChain: SupportedChain;
  amount: string;
}) => {
  const { uid, sourceChain, amount } = params;

  if (sourceChain === BASE_DESTINATION_CHAIN) {
    throw new Error("Source chain is already Base.");
  }

  const userSnap = await firestoreAdmin.collection("users").doc(uid).get();
  const walletsByChain = (userSnap.data()?.circle?.walletsByChain ?? {}) as
    | Record<string, { address?: string }>
    | undefined;

  const sourceAddress = walletsByChain?.[sourceChain]?.address;
  const baseAddress = walletsByChain?.[BASE_DESTINATION_CHAIN]?.address;

  if (!sourceAddress || !baseAddress) {
    throw new Error("Missing source or base wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[sourceChain],
    address: sourceAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[BASE_DESTINATION_CHAIN],
    address: baseAddress,
    recipientAddress: baseAddress,
  };

  console.log("BridgeKit: USDC to Base", {
    uid,
    amount,
    fromChain: from.chain,
    fromAddress: from.address,
    toChain: to.chain,
    toAddress: to.recipientAddress,
  });

  return kit.bridge({
    from: from as any,
    to: to as any,
    amount,
  });
};

export const estimateBridgeUsdcToBaseForUser = async (params: {
  uid: string;
  sourceChain: SupportedChain;
  amount: string;
}) => {
  const { uid, sourceChain, amount } = params;

  if (sourceChain === BASE_DESTINATION_CHAIN) {
    throw new Error("Source chain is already Base.");
  }

  const userSnap = await firestoreAdmin.collection("users").doc(uid).get();
  const walletsByChain = (userSnap.data()?.circle?.walletsByChain ?? {}) as
    | Record<string, { address?: string }>
    | undefined;

  const sourceAddress = walletsByChain?.[sourceChain]?.address;
  const baseAddress = walletsByChain?.[BASE_DESTINATION_CHAIN]?.address;

  if (!sourceAddress || !baseAddress) {
    throw new Error("Missing source or base wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[sourceChain],
    address: sourceAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[BASE_DESTINATION_CHAIN],
    address: baseAddress,
    recipientAddress: baseAddress,
  };

  return kit.estimate({
    from: from as any,
    to: to as any,
    amount,
  });
};

export const bridgeUsdcFromBaseForUser = async (params: {
  uid: string;
  destinationChain: SupportedChain;
  amount: string;
  recipientAddress: string;
}) => {
  const { uid, destinationChain, amount, recipientAddress } = params;

  if (destinationChain === BASE_DESTINATION_CHAIN) {
    throw new Error("Destination chain is already Base.");
  }

  const userSnap = await firestoreAdmin.collection("users").doc(uid).get();
  const walletsByChain = (userSnap.data()?.circle?.walletsByChain ?? {}) as
    | Record<string, { address?: string }>
    | undefined;

  const baseAddress = walletsByChain?.[BASE_DESTINATION_CHAIN]?.address;
  if (!baseAddress) {
    throw new Error("Missing base wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[BASE_DESTINATION_CHAIN],
    address: baseAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[destinationChain],
    address: recipientAddress,
    recipientAddress,
  };

  console.log("BridgeKit: USDC from Base", {
    uid,
    amount,
    fromChain: from.chain,
    fromAddress: from.address,
    toChain: to.chain,
    toAddress: to.recipientAddress,
  });

  return kit.bridge({
    from: from as any,
    to: to as any,
    amount,
  });
};

export const estimateBridgeUsdcFromBaseForUser = async (params: {
  uid: string;
  destinationChain: SupportedChain;
  amount: string;
  recipientAddress: string;
}) => {
  const { uid, destinationChain, amount, recipientAddress } = params;

  if (destinationChain === BASE_DESTINATION_CHAIN) {
    throw new Error("Destination chain is already Base.");
  }

  const userSnap = await firestoreAdmin.collection("users").doc(uid).get();
  const walletsByChain = (userSnap.data()?.circle?.walletsByChain ?? {}) as
    | Record<string, { address?: string }>
    | undefined;

  const baseAddress = walletsByChain?.[BASE_DESTINATION_CHAIN]?.address;
  if (!baseAddress) {
    throw new Error("Missing base wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[BASE_DESTINATION_CHAIN],
    address: baseAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[destinationChain],
    address: recipientAddress,
    recipientAddress,
  };

  return kit.estimate({
    from: from as any,
    to: to as any,
    amount,
  });
};
