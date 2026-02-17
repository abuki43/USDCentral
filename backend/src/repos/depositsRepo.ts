import { firestoreAdmin } from "../lib/firebaseAdmin.js";

const getDepositsCollection = (uid: string) =>
  firestoreAdmin.collection("users").doc(uid).collection("deposits");

export const getDepositRef = (uid: string, depositId: string) =>
  getDepositsCollection(uid).doc(depositId);

export const findDepositByBridgeTxHash = async (uid: string, txHash: string) => {
  const snap = await getDepositsCollection(uid)
    .where("bridge.destinationTxHash", "==", txHash)
    .limit(1)
    .get();

  if (snap.empty || snap.docs.length === 0) return null;
  const [first] = snap.docs;
  if (!first) return null;
  return { id: first.id, data: first.data() };
};
