import { BridgeKit } from "@circle-fin/bridge-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

import { HUB_DESTINATION_CHAIN, type SupportedChain } from "../lib/chains.js";
import { getWalletByChain } from "../lib/wallets.js";
import { logger } from "../lib/logger.js";
import { getUserCircleWalletsByChain } from "../repos/usersRepo.js";

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

export const bridgeUsdcToHubForUser = async (params: {
  uid: string;
  sourceChain: SupportedChain;
  amount: string;
}) => {
  const { uid, sourceChain, amount } = params;

  if (sourceChain === HUB_DESTINATION_CHAIN) {
    throw new Error("Source chain is already the hub chain.");
  }

  const walletsByChain = await getUserCircleWalletsByChain(uid);

  const sourceAddress = walletsByChain?.[sourceChain]?.address;
  const hubAddress = walletsByChain?.[HUB_DESTINATION_CHAIN]?.address;

  if (!sourceAddress || !hubAddress) {
    logger.error(
      {
        uid,
        sourceChain,
        hubChain: HUB_DESTINATION_CHAIN,
        walletsByChainKeys: Object.keys(walletsByChain ?? {}),
        sourceAddress,
        hubAddress,
      },
      "Missing wallet addresses",
    );
    throw new Error("Missing source or hub wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const bridgeKitFromChain = BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[sourceChain];
  const bridgeKitToChain = BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[HUB_DESTINATION_CHAIN];

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: bridgeKitFromChain,
    address: sourceAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: bridgeKitToChain,
    address: hubAddress,
    recipientAddress: hubAddress,
  };

  logger.info(
    {
      uid,
      amount,
      sourceChainCircleKey: sourceChain,
      hubChainCircleKey: HUB_DESTINATION_CHAIN,
      fromChain: from.chain,
      fromAddress: from.address,
      toChain: to.chain,
      toAddress: to.recipientAddress,
      bridgeKitFromChain,
      bridgeKitToChain,
      walletsByChainKeys: Object.keys(walletsByChain ?? {}),
    },
    "BridgeKit: USDC to Hub",
  );

  const result = await kit.bridge({
    from: from as any,
    to: to as any,
    amount,
  });
};

export const estimateBridgeUsdcToHubForUser = async (params: {
  uid: string;
  sourceChain: SupportedChain;
  amount: string;
}) => {
  const { uid, sourceChain, amount } = params;

  if (sourceChain === HUB_DESTINATION_CHAIN) {
    throw new Error("Source chain is already the hub chain.");
  }

  const walletsByChain = await getUserCircleWalletsByChain(uid);

  const sourceAddress = walletsByChain?.[sourceChain]?.address;
  const hubAddress = walletsByChain?.[HUB_DESTINATION_CHAIN]?.address;

  if (!sourceAddress || !hubAddress) {
    throw new Error("Missing source or hub wallet address for user.");
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
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[HUB_DESTINATION_CHAIN],
    address: hubAddress,
    recipientAddress: hubAddress,
  };

  return kit.estimate({
    from: from as any,
    to: to as any,
    amount,
  });
};

export const bridgeUsdcFromHubForUser = async (params: {
  uid: string;
  destinationChain: SupportedChain;
  amount: string;
  recipientAddress: string;
}) => {
  const { uid, destinationChain, amount, recipientAddress } = params;

  if (destinationChain === HUB_DESTINATION_CHAIN) {
    throw new Error("Destination chain is already the hub chain.");
  }

  const walletsByChain = await getUserCircleWalletsByChain(uid);

  const hubAddress = getWalletByChain(walletsByChain, HUB_DESTINATION_CHAIN)?.address;
  const destinationWallet = getWalletByChain(walletsByChain, destinationChain);
  const destinationAddress = destinationWallet?.address;
  if (!hubAddress) {
    throw new Error("Missing hub wallet address for user.");
  }
  if (!destinationAddress) {
    throw new Error("Missing destination wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[HUB_DESTINATION_CHAIN],
    address: hubAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[destinationChain],
    address: destinationAddress,
    recipientAddress,
  };

  logger.info(
    {
      uid,
      amount,
      fromChain: from.chain,
      fromAddress: from.address,
      toChain: to.chain,
      toAddress: to.recipientAddress,
    },
    "BridgeKit: USDC from Hub",
  );

  return kit.bridge({
    from: from as any,
    to: to as any,
    amount,
  });
};

export const estimateBridgeUsdcFromHubForUser = async (params: {
  uid: string;
  destinationChain: SupportedChain;
  amount: string;
  recipientAddress: string;
}) => {
  const { uid, destinationChain, amount, recipientAddress } = params;

  if (destinationChain === HUB_DESTINATION_CHAIN) {
    throw new Error("Destination chain is already the hub chain.");
  }

  const walletsByChain = await getUserCircleWalletsByChain(uid);

  const hubAddress = getWalletByChain(walletsByChain, HUB_DESTINATION_CHAIN)?.address;
  const destinationWallet = getWalletByChain(walletsByChain, destinationChain);
  const destinationAddress = destinationWallet?.address;
  if (!hubAddress) {
    throw new Error("Missing hub wallet address for user.");
  }
  if (!destinationAddress) {
    throw new Error("Missing destination wallet address for user.");
  }

  const adapter = getBridgeKitAdapter();
  const kit = getBridgeKit();

  const from: { adapter: ReturnType<typeof getBridgeKitAdapter>; chain: BridgeKitChain; address: string } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[HUB_DESTINATION_CHAIN],
    address: hubAddress,
  };

  const to: {
    adapter: ReturnType<typeof getBridgeKitAdapter>;
    chain: BridgeKitChain;
    address: string;
    recipientAddress: string;
  } = {
    adapter,
    chain: BRIDGE_KIT_CHAIN_BY_CIRCLE_CHAIN[destinationChain],
    address: destinationAddress,
    recipientAddress,
  };

  return kit.estimate({
    from: from as any,
    to: to as any,
    amount,
  });
};
