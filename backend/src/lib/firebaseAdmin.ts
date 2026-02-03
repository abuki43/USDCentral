import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

// Ensure env is loaded even if this module is imported before the server entrypoint runs.
dotenv.config({ path: ".env.local" });
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

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
