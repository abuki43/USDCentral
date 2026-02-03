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
  errorMessage: string | null;
  initialize: () => Promise<void>;
  enableLocalAuth: () => Promise<boolean>;
  disableLocalAuth: () => Promise<void>;
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
  errorMessage: null,
  initialize: async () => {
    const [enabledValue, pinHash, biometricsValue, hasHardware] = await Promise.all([
      SecureStore.getItemAsync(LOCAL_AUTH_ENABLED_KEY),
      SecureStore.getItemAsync(LOCAL_AUTH_PIN_HASH_KEY),
      SecureStore.getItemAsync(LOCAL_AUTH_BIOMETRICS_KEY),
      LocalAuthentication.hasHardwareAsync(),
    ]);

    const supportedTypes = hasHardware
      ? await LocalAuthentication.supportedAuthenticationTypesAsync()
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
      isLocked: isEnabled,
    });
  },
  enableLocalAuth: async () => {
    const { pinSet } = get();
    if (!pinSet) {
      set({ errorMessage: 'Set a 4-digit PIN before enabling local sign-in.' });
      return false;
    }

    await SecureStore.setItemAsync(LOCAL_AUTH_ENABLED_KEY, 'true');
    set({ isEnabled: true, isLocked: true });
    return true;
  },
  disableLocalAuth: async () => {
    await Promise.all([
      SecureStore.setItemAsync(LOCAL_AUTH_ENABLED_KEY, 'false'),
      SecureStore.setItemAsync(LOCAL_AUTH_BIOMETRICS_KEY, 'false'),
    ]);
    set({
      isEnabled: false,
      biometricsEnabled: false,
      isLocked: false,
    });
  },
  setPin: async (pin: string) => {
    if (!/^\d{4}$/.test(pin)) {
      set({ errorMessage: 'PIN must be exactly 4 digits.' });
      return false;
    }
    const hashed = await hashPin(pin);
    await SecureStore.setItemAsync(LOCAL_AUTH_PIN_HASH_KEY, hashed);
    set({ pinSet: true });
    return true;
  },
  unlockWithPin: async (pin: string) => {
    const storedHash = await SecureStore.getItemAsync(LOCAL_AUTH_PIN_HASH_KEY);
    if (!storedHash) {
      set({ errorMessage: 'No PIN is set yet.' });
      return false;
    }

    const hashed = await hashPin(pin);
    if (hashed !== storedHash) {
      set({ errorMessage: 'Incorrect PIN.' });
      return false;
    }

    set({ isLocked: false, errorMessage: null });
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

    set({ isLocked: false, errorMessage: null });
    return true;
  },
  setBiometricsEnabled: async (enabled: boolean) => {
    const { biometricsSupported } = get();
    if (enabled && !biometricsSupported) {
      set({ errorMessage: 'Biometrics are not supported on this device.' });
      return;
    }
    await SecureStore.setItemAsync(LOCAL_AUTH_BIOMETRICS_KEY, enabled ? 'true' : 'false');
    set({ biometricsEnabled: enabled });
  },
  lock: () => set({ isLocked: true }),
  clearError: () => set({ errorMessage: null }),
}));
