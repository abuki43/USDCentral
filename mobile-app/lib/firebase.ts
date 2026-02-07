import Constants from 'expo-constants';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
};

const firebaseConfig = Constants.expoConfig?.extra?.firebase as
  | FirebaseClientConfig
  | undefined;

const isTestEnvironment = process.env.NODE_ENV === 'test';

// console.log('Firebase Client Config:', {
//   apiKey: firebaseConfig?.apiKey,
//   projectId: firebaseConfig?.projectId,
//   appId: firebaseConfig?.appId,
// });

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId || !firebaseConfig?.appId) {
  if (!isTestEnvironment) {
    throw new Error(
      'Missing Firebase configuration. Set `extra.firebase` in app.json or app.config.ts.',
    );
  }
}

const resolvedConfig: FirebaseClientConfig = firebaseConfig ?? {
  apiKey: 'test-api-key',
  projectId: 'test-project',
  appId: 'test-app-id',
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(resolvedConfig);

export const firebaseApp = app;
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const firebaseAuth = authInstance;
export const firestore = getFirestore(app);
