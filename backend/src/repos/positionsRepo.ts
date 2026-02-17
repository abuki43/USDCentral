import { firestoreAdmin } from "../lib/firebaseAdmin.js";

export const getCurvePositionRef = (uid: string) =>
  firestoreAdmin.collection("users").doc(uid).collection("positions").doc("curve");

export const getCurvePosition = async (uid: string) => {
  const snap = await getCurvePositionRef(uid).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as any) : null;
};
