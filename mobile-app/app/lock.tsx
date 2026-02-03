import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';
import { useLocalAuthStore } from '@/store/localAuthStore';

export default function LockScreen() {
  const { user } = useAuthStore();
  const {
    isEnabled,
    isLocked,
    biometricsEnabled,
    unlockWithPin,
    unlockWithBiometrics,
    errorMessage,
    clearError,
  } = useLocalAuthStore();
  const [pin, setPin] = useState('');

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isEnabled || !isLocked) {
    return <Redirect href="/(tabs)" />;
  }

  const handlePinUnlock = async () => {
    const success = await unlockWithPin(pin);
    if (success) {
      setPin('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Unlock USDCentral</Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN to continue.</Text>

        <AuthTextInput
          label="PIN"
          value={pin}
          onChangeText={(value) => {
            if (errorMessage) clearError();
            setPin(value.replace(/[^0-9]/g, '').slice(0, 4));
          }}
          keyboardType="number-pad"
          secureTextEntry
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <PrimaryButton label="Unlock" onPress={handlePinUnlock} disabled={pin.length !== 4} />

        {biometricsEnabled ? (
          <PrimaryButton label="Use fingerprint / Face ID" onPress={unlockWithBiometrics} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  error: {
    color: '#ff4d4f',
  },
});
