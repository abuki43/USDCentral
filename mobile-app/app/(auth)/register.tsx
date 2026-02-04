import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/authStore';

export default function RegisterScreen() {
  const { register, isSubmitting, errorMessage, clearError, user, initializing } =
    useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (initializing) {
    return null;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const disabled = isSubmitting || !displayName.trim() || !email.trim() || !password;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-0 px-6"
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View className="flex-1 justify-center">
        <View className="mb-6">
          <Text className="text-xs text-ink-500 font-sans-medium tracking-widest uppercase">
            USDCentral
          </Text>
          <Text className="text-3xl text-ink-900 font-sans-bold mt-2">
            Create account
          </Text>
          <Text className="text-base text-ink-500 font-sans mt-2">
            Start building your unified USDC balance.
          </Text>
        </View>

        <View className="bg-surface-1 border border-stroke-100 rounded-3xl p-5">
          <AuthTextInput
            label="Full name"
            value={displayName}
            onChangeText={(value) => {
              if (errorMessage) clearError();
              setDisplayName(value);
            }}
          />
          <AuthTextInput
            label="Email"
            value={email}
            onChangeText={(value) => {
              if (errorMessage) clearError();
              setEmail(value);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AuthTextInput
            label="Password"
            value={password}
            onChangeText={(value) => {
              if (errorMessage) clearError();
              setPassword(value);
            }}
            secureTextEntry
          />

          {errorMessage ? (
            <Text className="text-danger-500 font-sans mb-4">{errorMessage}</Text>
          ) : null}

          <PrimaryButton
            label={isSubmitting ? 'Creating...' : 'Create account'}
            onPress={() => register(email, password, displayName)}
            disabled={disabled}
          />

          <View className="flex-row items-center justify-center mt-5">
            <Text className="text-ink-500 font-sans">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-primary-600 font-sans-semibold">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
