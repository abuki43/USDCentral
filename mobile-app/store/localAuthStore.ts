import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const LOCAL_AUTH_ENABLED_KEY = 'local_auth_enabled';
const LOCAL_AUTH_PIN_HASH_KEY = 'local_auth_pin_hash';
const LOCAL_AUTH_BIOMETRICS_KEY = 'local_auth_biometrics_enabled';

const hashPin = async (pin: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);

type LocalAuthState = {
  isInitialized: boolean;
  isEnabled: boolean;
  isLocked: boolean;
  biometricsSupported: boolean;
  biometricsEnabled: boolean;
  pinSet: boolean;
  pinVerifiedThisSession: boolean;
  errorMessage: string | null;
  initialize: () => Promise<void>;
  enableLocalAuth: () => Promise<boolean>;
  disableLocalAuth: () => Promise<void>;
  clearLocalAuth: () => Promise<void>;
  setPin: (pin: string) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  lock: () => void;
  clearError: () => void;
};

export const useLocalAuthStore = create<LocalAuthState>((set, get) => ({
  isInitialized: false,
  isEnabled: false,
  isLocked: false,
  biometricsSupported: false,
  biometricsEnabled: false,
  pinSet: false,
  pinVerifiedThisSession: false,
  errorMessage: null,
  initialize: async () => {
    try {
      const [enabledValue, pinHash, biometricsValue, hasHardware] = await Promise.all([
        SecureStore.getItemAsync(LOCAL_AUTH_ENABLED_KEY).catch(() => null),
        SecureStore.getItemAsync(LOCAL_AUTH_PIN_HASH_KEY).catch(() => null),
        SecureStore.getItemAsync(LOCAL_AUTH_BIOMETRICS_KEY).catch(() => null),
        LocalAuthentication.hasHardwareAsync().catch(() => false),
      ]);

      const supportedTypes = hasHardware
        ? await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [])
        : [];

      const biometricsSupported = supportedTypes.length > 0;

      const isEnabled = enabledValue === 'true';
      const biometricsEnabled = biometricsValue === 'true' && biometricsSupported;
      const pinSet = Boolean(pinHash);

      set({
        isInitialized: true,
        isEnabled,
        biometricsSupported,
        biometricsEnabled,
        pinSet,
        pinVerifiedThisSession: false,
        isLocked: isEnabled,
      });
    } catch (e) {
      console.log('Local auth initialization failed, continuing without PIN:', e);
      set({
        isInitialized: true,
        isEnabled: false,
        biometricsSupported: false,
        biometricsEnabled: false,
        pinSet: false,
        pinVerifiedThisSession: false,
        isLocked: false,
      });
    }
  },
  enableLocalAuth: async () => {
    const { pinSet } = get();
    if (!pinSet) {
      set({ errorMessage: 'Set a 4-digit PIN before enabling local sign-in.' });
      return false;
    }

    try {
      await SecureStore.setItemAsync(LOCAL_AUTH_ENABLED_KEY, 'true');
    } catch (e) {
      console.log('Failed to save local auth enabled state:', e);
    }
    set({ isEnabled: true, isLocked: true });
    return true;
  },
  disableLocalAuth: async () => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(LOCAL_AUTH_ENABLED_KEY, 'false'),
        SecureStore.setItemAsync(LOCAL_AUTH_BIOMETRICS_KEY, 'false'),
      ]);
    } catch (e) {
      console.log('Failed to save local auth disabled state:', e);
    }
    set({
      isEnabled: false,
      biometricsEnabled: false,
      isLocked: false,
    });
  },
  clearLocalAuth: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(LOCAL_AUTH_ENABLED_KEY),
        SecureStore.deleteItemAsync(LOCAL_AUTH_PIN_HASH_KEY),
        SecureStore.deleteItemAsync(LOCAL_AUTH_BIOMETRICS_KEY),
      ]);
    } catch (e) {
      console.log('Failed to clear local auth data:', e);
    }
    set({
      isEnabled: false,
      isLocked: false,
      biometricsEnabled: false,
      pinSet: false,
      pinVerifiedThisSession: false,
      errorMessage: null,
    });
  },
  setPin: async (pin: string) => {
    if (!/^\d{4}$/.test(pin)) {
      set({ errorMessage: 'PIN must be exactly 4 digits.' });
      return false;
    }
    const hashed = await hashPin(pin);
    try {
      await SecureStore.setItemAsync(LOCAL_AUTH_PIN_HASH_KEY, hashed);
    } catch (e) {
      console.log('Failed to save PIN hash:', e);
      set({ errorMessage: 'Failed to save PIN. Please try again.' });
      return false;
    }
    set({ pinSet: true });
    return true;
  },
  unlockWithPin: async (pin: string) => {
    let storedHash: string | null = null;
    try {
      storedHash = await SecureStore.getItemAsync(LOCAL_AUTH_PIN_HASH_KEY);
    } catch (e) {
      console.log('Failed to read PIN hash:', e);
    }
    if (!storedHash) {
      set({ errorMessage: 'No PIN is set yet.' });
      return false;
    }

    const hashed = await hashPin(pin);
    if (hashed !== storedHash) {
      set({ errorMessage: 'Incorrect PIN.' });
      return false;
    }

    set({ isLocked: false, errorMessage: null, pinVerifiedThisSession: true });
    return true;
  },
  unlockWithBiometrics: async () => {
    const { biometricsSupported, biometricsEnabled } = get();
    if (!biometricsSupported || !biometricsEnabled) {
      set({ errorMessage: 'Biometric authentication is not enabled.' });
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock USDCentral',
      fallbackLabel: 'Use PIN instead',
    });

    if (!result.success) {
      set({ errorMessage: 'Biometric authentication failed.' });
      return false;
    }

    set({ isLocked: false, errorMessage: null, pinVerifiedThisSession: true });
    return true;
  },
  setBiometricsEnabled: async (enabled: boolean) => {
    const { biometricsSupported } = get();
    if (enabled && !biometricsSupported) {
      set({ errorMessage: 'Biometrics are not supported on this device.' });
      return;
    }
    try {
      await SecureStore.setItemAsync(LOCAL_AUTH_BIOMETRICS_KEY, enabled ? 'true' : 'false');
    } catch (e) {
      console.log('Failed to save biometrics state:', e);
    }
    set({ biometricsEnabled: enabled });
  },
  lock: () => set({ isLocked: true }),
  clearError: () => set({ errorMessage: null }),
}));
