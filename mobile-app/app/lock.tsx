import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
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
      className="flex-1 bg-surface-0 px-6"
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View className="flex-1 justify-center">
        <View className="mb-6">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            Secure
          </Text>
          <Text className="text-3xl text-ink-900 font-sans-bold mt-2">
            Unlock USDCentral
          </Text>
          <Text className="text-base text-ink-500 font-sans mt-2">
            Enter your 4-digit PIN to continue.
          </Text>
        </View>

        <View className="bg-surface-1 border border-stroke-100 rounded-3xl p-5">
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

          {errorMessage ? (
            <Text className="text-danger-500 font-sans mb-4">{errorMessage}</Text>
          ) : null}

          <PrimaryButton
            label="Unlock"
            onPress={handlePinUnlock}
            disabled={pin.length !== 4}
          />

          {biometricsEnabled ? (
            <View className="mt-3">
              <PrimaryButton
                label="Use fingerprint / Face ID"
                onPress={unlockWithBiometrics}
              />
            </View>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
