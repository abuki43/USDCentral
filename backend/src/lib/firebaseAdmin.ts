import admin from "firebase-admin";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import "dotenv/config";




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
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

export { firebaseAdminApp };
export const firebaseAuthAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
