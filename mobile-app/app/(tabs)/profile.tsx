import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';
import { useLocalAuthStore } from '@/store/localAuthStore';

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const {
    isEnabled,
    biometricsSupported,
    biometricsEnabled,
    pinSet,
    errorMessage,
    enableLocalAuth,
    disableLocalAuth,
    setPin,
    setBiometricsEnabled,
    lock,
    clearError,
  } = useLocalAuthStore();

  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const handleSetPin = async () => {
    if (pin !== pinConfirm) {
      setPinError('PIN entries do not match.');
      return;
    }
    setPinError(null);
    const success = await setPin(pin);
    if (success) {
      setPinValue('');
      setPinConfirm('');
    }
  };

  const handleToggleLocalAuth = async (value: boolean) => {
    if (value) {
      await enableLocalAuth();
    } else {
      await disableLocalAuth();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Full name</Text>
          <Text style={styles.value}>{user?.displayName ?? '—'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Local sign-in</Text>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Enable local sign-in</Text>
          <Switch value={isEnabled} onValueChange={handleToggleLocalAuth} />
        </View>

        {!pinSet ? (
          <View style={styles.pinSection}>
            <Text style={styles.subtitle}>Set a 4-digit PIN to secure your app.</Text>
            <AuthTextInput
              label="New PIN"
              value={pin}
              onChangeText={(value) => {
                setPinError(null);
                setPinValue(value.replace(/[^0-9]/g, '').slice(0, 4));
              }}
              keyboardType="number-pad"
              secureTextEntry
            />
            <AuthTextInput
              label="Confirm PIN"
              value={pinConfirm}
              onChangeText={(value) => {
                setPinError(null);
                setPinConfirm(value.replace(/[^0-9]/g, '').slice(0, 4));
              }}
              keyboardType="number-pad"
              secureTextEntry
            />
            <PrimaryButton
              label="Save PIN"
              onPress={handleSetPin}
              disabled={pin.length !== 4 || pinConfirm.length !== 4}
            />
            {pinError ? <Text style={styles.error}>{pinError}</Text> : null}
          </View>
        ) : null}

        {biometricsSupported ? (
          <View style={styles.switchRow}>
            <Text style={styles.label}>Use fingerprint / Face ID</Text>
            <Switch
              value={biometricsEnabled}
              onValueChange={(value) => setBiometricsEnabled(value)}
              disabled={!isEnabled}
            />
          </View>
        ) : (
          <Text style={styles.subtitle}>Biometrics are not available on this device.</Text>
        )}

        {isEnabled ? (
          <PrimaryButton label="Lock now" onPress={lock} />
        ) : null}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailRow: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
  },
  value: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinSection: {
    gap: 12,
  },
  error: {
    color: '#ff4d4f',
  },
});
