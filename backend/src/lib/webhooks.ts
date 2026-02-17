import crypto from "crypto";

import { getCircleClient } from "./circleClient.js";
import { withRetry } from "./retry.js";

const publicKeyCache = new Map<string, crypto.KeyObject>();

export const getCircleWebhookPublicKey = async (keyId: string) => {
  const cached = publicKeyCache.get(keyId);
  if (cached) return cached;

  const circle = getCircleClient();
  const resp = await withRetry(() => circle.getNotificationSignature(keyId), {
    retries: 2,
  });
  const publicKeyBase64 = resp.data?.publicKey;
  if (!publicKeyBase64) {
    throw new Error("Missing publicKey from Circle.");
  }

  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64");
  const key = crypto.createPublicKey({
    key: publicKeyBytes,
    format: "der",
    type: "spki",
  });

  publicKeyCache.set(keyId, key);
  return key;
};

export const verifyCircleWebhookSignature = async (params: {
  keyId: string;
  signature: string;
  payload: Buffer;
}) => {
  const { keyId, signature, payload } = params;
  const publicKey = await getCircleWebhookPublicKey(keyId);
  const signatureBytes = Buffer.from(signature, "base64");
  return crypto.verify("sha256", payload, publicKey, signatureBytes);
};
