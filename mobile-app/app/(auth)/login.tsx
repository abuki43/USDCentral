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

export default function LoginScreen() {
  const { login, isSubmitting, errorMessage, clearError, user, initializing } =
    useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (initializing) {
    return null;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const disabled = isSubmitting || !email.trim() || !password;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your USDCentral account.</Text>

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
          label={isSubmitting ? 'Signing in...' : 'Sign in'}
          onPress={() => login(email, password)}
          disabled={disabled}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <Link href="/(auth)/register" style={styles.footerLink}>
            Create an account
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
