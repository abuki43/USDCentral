import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { config } from "../config.js";

export const getCircleClient = () => {
  const apiKey = config.CIRCLE_API_KEY;
  const entitySecret = config.CIRCLE_ENTITY_SECRET;
  const baseUrl = process.env.CIRCLE_BASE_URL;

  if (!apiKey || !entitySecret) {
    throw new Error(
      "Missing Circle config. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET.",
    );
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
    ...(baseUrl ? { baseUrl } : {}),
  });
};

export const getCircleWalletSetId = () => {
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  if (!walletSetId) {
    throw new Error("Missing Circle config. Set CIRCLE_WALLET_SET_ID.");
  }
  return walletSetId;
};
