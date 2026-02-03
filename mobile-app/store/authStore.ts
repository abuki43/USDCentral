import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { backendFetch } from '@/lib/backend';
import { firebaseAuth, firestore } from '@/lib/firebase';

type AuthState = {
  user: User | null;
  initializing: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const formatFirebaseError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('auth/invalid-credential')) {
      return 'Invalid email or password.';
    }
    if (error.message.includes('auth/email-already-in-use')) {
      return 'Email is already registered.';
    }
    if (error.message.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (error.message.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
};

let authListenerInitialized = false;
let lastProvisionedUid: string | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  isSubmitting: false,
  errorMessage: null,
  initialize: () => {
    if (authListenerInitialized) return;
    authListenerInitialized = true;

    onAuthStateChanged(
      firebaseAuth,
      async (user) => {
        set({ user, initializing: false });

        if (user) {
          await setDoc(
            doc(firestore, 'users', user.uid),
            {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName ?? null,
              lastLoginAt: serverTimestamp(),
            },
            { merge: true },
          );

          console.log("User document updated");
          if (user.uid !== lastProvisionedUid) {
            console.log("Provisioning circle wallets for user:", user.uid);
            lastProvisionedUid = user.uid;
            backendFetch('/circle/provision', {
              method: 'POST',
              body: JSON.stringify({}),
            }).catch((err) => {
              if (__DEV__) {
                const message = err instanceof Error ? err.message : String(err);
                console.log('Circle provision failed:', message);
              }
            });
          }
        }
      },
      (error) => {
        set({ errorMessage: formatFirebaseError(error), initializing: false });
      },
    );
  },
  login: async (email, password) => {
    set({ isSubmitting: true, errorMessage: null });
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (error) {
      set({ errorMessage: formatFirebaseError(error) });
    } finally {
      set({ isSubmitting: false });
    }
  },
  register: async (email, password, displayName) => {
    set({ isSubmitting: true, errorMessage: null });
    try {
      if (!displayName?.trim()) {
        set({ errorMessage: 'Full name is required.' });
        return;
      }

      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password,
      );

      await updateProfile(credential.user, { displayName: displayName.trim() });

      await setDoc(
        doc(firestore, 'users', credential.user.uid),
        {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: displayName.trim(),
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      set({ errorMessage: formatFirebaseError(error) });
    } finally {
      set({ isSubmitting: false });
    }
  },
  logout: async () => {
    set({ isSubmitting: true, errorMessage: null });
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      set({ errorMessage: formatFirebaseError(error) });
    } finally {
      set({ isSubmitting: false });
    }
  },
  clearError: () => set({ errorMessage: null }),
}));
