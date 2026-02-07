import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "../config.js";

const projectId = config.FIREBASE_PROJECT_ID;
const clientEmail = config.FIREBASE_CLIENT_EMAIL;
const privateKey = config.FIREBASE_PRIVATE_KEY;

// console.log("Firebase Admin Config:", {
//   projectId,
//   clientEmail,
//   hasPrivateKey: !!privateKey,
// });

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
  );
}

const firebaseAdminApp = getApps().length
  ? getApp()
  : initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

export { firebaseAdminApp };
export const firebaseAuthAdmin = getAuth(firebaseAdminApp);
export const firestoreAdmin = getFirestore(firebaseAdminApp);
