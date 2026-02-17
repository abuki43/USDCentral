import admin from "firebase-admin";

import { firestoreAdmin } from "../lib/firebaseAdmin.js";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

export const getAlertRef = (uid: string, docId: string) =>
  firestoreAdmin.collection("users").doc(uid).collection("alerts").doc(docId);

export const upsertInboundAlertIfChanged = async (
  uid: string,
  payload: {
    txId: string;
    state: string;
    blockchain: string | null;
    amount: string;
    symbol: string | null;
  },
) => {
  const alertRef = getAlertRef(uid, "inboundUSDC");
  const snap = await alertRef.get();
  const current = snap.exists ? (snap.data() as Record<string, unknown>) : null;

  const isSame =
    current &&
    current.txId === payload.txId &&
    current.state === payload.state &&
    current.blockchain === payload.blockchain &&
    current.amount === payload.amount &&
    current.symbol === payload.symbol;

  if (isSame) return;

  await alertRef.set(
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};
