import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/authStore';
import { useLocalAuthStore } from '@/store/localAuthStore';

export default function ProfileScreen() {
  const { user, logout, isSubmitting } = useAuthStore();
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
  const [copied, setCopied] = useState(false);

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

  const handleCopyUid = async () => {
    if (!user?.uid) return;
    await Clipboard.setStringAsync(user.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ScrollView className="flex-1 bg-surface-0">
      <View className="px-6 pt-6 pb-10">
        <Text className="text-2xl text-ink-900 font-sans-bold">Profile</Text>

        <View className="mt-4 bg-surface-1 border border-stroke-100 rounded-3xl p-5">
        <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
          Account
        </Text>

        <View className="mt-4">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            Full name
          </Text>
          <Text className="text-base text-ink-900 font-sans mt-1">
            {user?.displayName ?? '—'}
          </Text>
        </View>

        <View className="mt-4">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            Email
          </Text>
          <Text className="text-base text-ink-900 font-sans mt-1">{user?.email ?? '—'}</Text>
        </View>

        <View className="mt-4">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            App ID
          </Text>
          <View className="mt-2 flex-row items-center justify-between rounded-2xl border border-stroke-100 bg-white px-4 py-3">
            <Text className="text-xs text-ink-900 font-sans" numberOfLines={1}>
              {user?.uid ?? '—'}
            </Text>
            <Pressable onPress={handleCopyUid} disabled={!user?.uid}>
              <Text className="text-xs font-sans-semibold text-primary-600">
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          </View>
        </View>
        </View>

        <View className="mt-4 bg-surface-1 border border-stroke-100 rounded-3xl p-5">
        <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
          Local sign-in
        </Text>

        <View className="flex-row items-center justify-between mt-4">
          <Text className="text-base text-ink-900 font-sans">Enable local sign-in</Text>
          <Switch value={isEnabled} onValueChange={handleToggleLocalAuth} />
        </View>

        {!pinSet ? (
          <View className="mt-4">
            <Text className="text-sm text-ink-500 font-sans mb-3">
              Set a 4-digit PIN to secure your app.
            </Text>
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
            {pinError ? (
              <Text className="text-danger-500 font-sans mt-3">{pinError}</Text>
            ) : null}
          </View>
        ) : null}

        {biometricsSupported ? (
          <View className="flex-row items-center justify-between mt-4">
            <Text className="text-base text-ink-900 font-sans">Use fingerprint / Face ID</Text>
            <Switch
              value={biometricsEnabled}
              onValueChange={(value) => setBiometricsEnabled(value)}
              disabled={!isEnabled}
            />
          </View>
        ) : (
          <Text className="text-sm text-ink-500 font-sans mt-4">
            Biometrics are not available on this device.
          </Text>
        )}

        {isEnabled ? (
          <View className="mt-4">
            <PrimaryButton label="Lock now" onPress={lock} />
          </View>
        ) : null}

        {errorMessage ? (
          <Text className="text-danger-500 font-sans mt-4">{errorMessage}</Text>
        ) : null}
        </View>

        <View className="mt-4 bg-surface-1 border border-stroke-100 rounded-3xl p-5">
        <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
          Sign out
        </Text>
        <View className="mt-4">
          <PrimaryButton
            label={isSubmitting ? 'Signing out...' : 'Sign out'}
            onPress={logout}
            disabled={isSubmitting}
          />
        </View>
        </View>
      </View>
    </ScrollView>
  );
}
