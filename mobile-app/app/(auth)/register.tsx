import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import AuthTextInput from '@/components/AuthTextInput';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
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
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start building your unified USDC balance.</Text>

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

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <PrimaryButton
          label={isSubmitting ? 'Creating...' : 'Create account'}
          onPress={() => register(email, password, displayName)}
          disabled={disabled}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" style={styles.footerLink}>
            Sign in
          </Link>
        </View>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
  },
  error: {
    color: '#ff4d4f',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    opacity: 0.7,
  },
  footerLink: {
    color: '#1b4dff',
    fontWeight: '600',
  },
});
