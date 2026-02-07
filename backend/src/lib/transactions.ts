import admin from "firebase-admin";

import { firestoreAdmin } from "./firebaseAdmin.js";

export type UnifiedTransactionKind =
  | "DEPOSIT"
  | "WITHDRAW"
  | "SEND"
  | "SWAP"
  | "BRIDGE"
  | "EARN";

export type UnifiedTransactionStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "FAILED"
  | "BRIDGING";

export type UnifiedTransactionRecord = {
  id: string;
  kind: UnifiedTransactionKind;
  status: UnifiedTransactionStatus;
  amount: string;
  symbol: string | null;
  blockchain: string | null;
  sourceChain?: string | null;
  destinationChain?: string | null;
  txHash?: string | null;
  relatedTxId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp | string;
  updatedAt: admin.firestore.FieldValue | admin.firestore.Timestamp | string;
};

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

export const getUserTransactionsRef = (uid: string) =>
  firestoreAdmin.collection("users").doc(uid).collection("transactions");

export const upsertTransaction = async (
  uid: string,
  id: string,
  payload: Omit<UnifiedTransactionRecord, "id" | "createdAt" | "updatedAt">,
) => {
  const ref = getUserTransactionsRef(uid).doc(id);
  const snap = await ref.get();
  const base = {
    id,
    ...payload,
    updatedAt: serverTimestamp(),
  } as UnifiedTransactionRecord;

  if (!snap.exists) {
    await ref.set({
      ...base,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await ref.set(base, { merge: true });
};
